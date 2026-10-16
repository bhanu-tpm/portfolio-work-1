import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ConfigurationError, env } from "@/lib/env";

/**
 * Per-request client bound to the signed-in user's session.
 * Every query runs under Row-Level Security as that user.
 */
export async function createClient() {
  const url = env.supabaseUrl();
  const key = env.supabasePublishableKey();
  if (!url || !key) throw new ConfigurationError("Supabase");

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS: only use after an explicit server-side
 * authorization check, for system tasks (notifications, AI usage records,
 * storage, cron) and never expose it to the browser.
 */
export function createAdminClient() {
  const url = env.supabaseUrl();
  const key = env.supabaseSecretKey();
  if (!url || !key) throw new ConfigurationError("Supabase service role key");
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Anonymous client without cookies, safe to use inside `'use cache'` scopes
 * for public content. RLS limits it to published/public rows.
 */
export function createPublicClient() {
  const url = env.supabaseUrl();
  const key = env.supabasePublishableKey();
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
