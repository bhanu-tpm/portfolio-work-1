import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let t: TestDb;
let admin: string;

beforeAll(async () => {
  t = await createTestDb();
  admin = await t.createUser("hindi-admin@example.test", { admin: true });
  await t.as("authenticated", admin, (q) =>
    q(
      `insert into public.blog_posts (slug, title, title_hi, content, content_hi, status, published_at) values
        ('hindi-live', 'Live post', 'प्रकाशित लेख', 'English body', 'हिंदी सामग्री', 'published', now() - interval '1 minute'),
        ('hindi-draft', 'Draft post', 'मसौदा लेख', '', null, 'draft', null)`,
    ),
  );
});

describe("Hindi blog content and RLS", () => {
  it("lets an anonymous visitor read a published post's Hindi title", async () => {
    const res = await t.as("anon", null, (q) =>
      q<{ title_hi: string | null; content_hi: string | null }>(
        "select title_hi, content_hi from public.blog_posts where slug = 'hindi-live'",
      ),
    );
    expect(res.rows).toEqual([{ title_hi: "प्रकाशित लेख", content_hi: "हिंदी सामग्री" }]);
  });

  it("hides a draft post (and its Hindi title) from anonymous visitors", async () => {
    const res = await t.as("anon", null, (q) =>
      q<{ title_hi: string | null }>("select title_hi from public.blog_posts where slug = 'hindi-draft'"),
    );
    expect(res.rows).toHaveLength(0);
    const all = await t.as("anon", null, (q) => q<{ title_hi: string | null }>("select title_hi from public.blog_posts"));
    expect(all.rows.map((r) => r.title_hi)).not.toContain("मसौदा लेख");
  });

  it("lets the admin see the draft's Hindi title", async () => {
    const res = await t.as("authenticated", admin, (q) =>
      q<{ title_hi: string | null }>("select title_hi from public.blog_posts where slug = 'hindi-draft'"),
    );
    expect(res.rows).toEqual([{ title_hi: "मसौदा लेख" }]);
  });

  it("enforces the Hindi length limits in the database", async () => {
    await expect(
      t.as("authenticated", admin, (q) =>
        q("update public.blog_posts set seo_title_hi = $1 where slug = 'hindi-live'", ["अ".repeat(71)]),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("does not let anonymous visitors write Hindi fields", async () => {
    await expect(
      t.as("anon", null, (q) => q("update public.blog_posts set title_hi = 'बदला गया' where slug = 'hindi-live'")),
    ).rejects.toThrow(/permission denied/);
  });
});
