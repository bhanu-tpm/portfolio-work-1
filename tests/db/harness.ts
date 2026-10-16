import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * Minimal stand-in for the parts of Supabase that the migrations depend on:
 * the `auth` schema (users table, auth.uid()), the API roles and the storage
 * buckets table. Everything else is the real migration SQL.
 */
const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
`;

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

export async function createTestDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }

  /** Run `fn` as an API role (anon/authenticated/service_role), optionally impersonating a user via JWT claims. */
  async function as<T>(
    role: "anon" | "authenticated" | "service_role",
    userId: string | null,
    fn: (q: typeof db.query) => Promise<T>,
  ): Promise<T> {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
    await db.query("select set_config('request.jwt.claim.role', $1, false)", [role]);
    await db.exec(`set role ${role}`);
    try {
      return await fn(db.query.bind(db));
    } finally {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', '', false)");
      await db.query("select set_config('request.jwt.claim.role', '', false)");
    }
  }

  async function createUser(email: string, opts: { admin?: boolean } = {}) {
    const id = crypto.randomUUID();
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      email,
      JSON.stringify({ full_name: email.split("@")[0] }),
    ]);
    if (opts.admin) await db.query("select public.grant_admin($1)", [email]);
    return id;
  }

  return { db, as, createUser };
}
