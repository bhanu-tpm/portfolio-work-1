import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/lib/env";

export class RateLimitError extends Error {
  constructor(message = "Too many requests. Please wait a little and try again.") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Postgres-backed fixed-window limiter (shared across serverless instances).
 * Fails open if the database is unreachable, but logs it.
 */
export async function checkRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!isServiceRoleConfigured()) return true;
  const { data, error } = await createAdminClient().rpc("consume_rate_limit", {
    limit_key: key,
    max_hits: max,
    window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] check failed", error.message);
    return true;
  }
  return data === true;
}

export async function enforceRateLimit(key: string, max: number, windowSeconds: number, message?: string) {
  if (!(await checkRateLimit(key, max, windowSeconds))) throw new RateLimitError(message);
}

/** Hashed client IP so raw addresses are never stored. */
export async function clientFingerprint(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
