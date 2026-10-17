import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { AppRole, Profile } from "@/lib/db/types";

export interface CurrentUser {
  id: string;
  email: string;
  roles: AppRole[];
  isAdmin: boolean;
  profile: Profile | null;
}

/**
 * Data Access Layer entry point. Verifies the session JWT (getClaims validates
 * the signature) and loads roles from the database. Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured()) return null;
  // getClaims compares the token expiry with the current time, so it must run at request time.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;

  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", sub),
    supabase.from("profiles").select("*").eq("id", sub).maybeSingle<Profile>(),
  ]);

  const roleList = (roles ?? []).map((r) => r.role as AppRole);
  return {
    id: sub,
    email: (data.claims.email as string | undefined) ?? profile?.email ?? "",
    roles: roleList,
    isAdmin: roleList.includes("admin"),
    profile: profile ?? null,
  };
});

/** For pages: redirects to login when signed out. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/** For admin pages: non-admins get a 404 so the admin area is not revealed. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (!user.isAdmin) notFound();
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "You are not allowed to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function assertUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Please sign in to continue.");
  return user;
}

export async function assertAdmin(): Promise<CurrentUser> {
  const user = await assertUser();
  if (!user.isAdmin) throw new AuthorizationError();
  return user;
}
