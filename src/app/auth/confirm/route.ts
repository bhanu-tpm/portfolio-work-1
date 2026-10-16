import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/redirect";

/**
 * Handles links from Supabase auth emails (sign-up confirmation, password
 * recovery, email change). Supports both the PKCE `code` flow and the
 * `token_hash` template flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  // Recovery links carry next=/reset-password or /hi/reset-password, which keeps the visitor's language.
  const recoveryTarget = next.endsWith("/reset-password") ? next : "/reset-password";
  const loginTarget = next.startsWith("/hi/") ? "/hi/login?error=link" : "/login?error=link";
  const target = ok ? (type === "recovery" ? recoveryTarget : next) : loginTarget;
  return NextResponse.redirect(new URL(target, origin));
}
