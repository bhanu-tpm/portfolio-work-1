"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { failure, formValues, validationFailure, type ActionState } from "@/lib/action-result";
import { clientFingerprint, enforceRateLimit } from "@/lib/rate-limit";
import { safeNext } from "@/lib/auth/redirect";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/schemas";
import { DEFAULT_LOCALE, isLocale, localePath, type Locale } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";

/**
 * Server Actions can't read the [lang] root param: the auth forms post their
 * locale as a hidden `locale` field. Zod field errors stay English here and are
 * translated for display on the client (translateState).
 */
function localeOf(values: Record<string, string>): Locale {
  return isLocale(values.locale) ? values.locale : DEFAULT_LOCALE;
}

function messagesFor(locale: Locale) {
  return { ...dictionaries[locale].auth.messages, generic: dictionaries[locale].validation.messages.generic };
}

function notConfigured(locale: Locale): ActionState {
  return { ok: false, message: messagesFor(locale).notConfigured };
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const locale = localeOf(values);
  const m = messagesFor(locale);
  if (!isSupabaseConfigured()) return notConfigured(locale);
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, { email: values.email ?? "" });

  try {
    const fp = await clientFingerprint();
    await enforceRateLimit(`login:${fp}`, 20, 900, m.tooManySignIns);
    await enforceRateLimit(`login:${parsed.data.email}`, 10, 900, m.tooManySignIns);

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      const unconfirmed = error.code === "email_not_confirmed";
      return {
        ok: false,
        message: unconfirmed ? m.unconfirmed : m.badCredentials,
        values: { email: parsed.data.email },
      };
    }
  } catch (err) {
    return { ...failure(err, m.generic), values: { email: values.email ?? "" } };
  }
  redirect(safeNext(values.next));
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const locale = localeOf(values);
  const m = messagesFor(locale);
  if (!isSupabaseConfigured()) return notConfigured(locale);
  const parsed = signUpSchema.safeParse(values);
  const echo = { fullName: values.fullName ?? "", email: values.email ?? "" };
  if (!parsed.success) return validationFailure(parsed.error, echo);

  const next = safeNext(values.next);
  let signedIn = false;
  try {
    const fp = await clientFingerprint();
    await enforceRateLimit(`signup:${fp}`, 5, 3600, m.tooManySignUps);

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${env.siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      return {
        ok: false,
        // Supabase's weak-password text is English-only; it's shown as is.
        message: error.code === "weak_password" ? error.message : m.signUpFailed,
        values: echo,
      };
    }
    // When email confirmation is disabled Supabase returns a session immediately.
    signedIn = Boolean(data.session);
  } catch (err) {
    return { ...failure(err, m.generic), values: echo };
  }
  if (signedIn) redirect(next);
  return { ok: true, message: m.confirmSent };
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const locale = localeOf(values);
  const m = messagesFor(locale);
  if (!isSupabaseConfigured()) return notConfigured(locale);
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, { email: values.email ?? "" });
  try {
    const fp = await clientFingerprint();
    await enforceRateLimit(`reset:${fp}`, 5, 3600, m.tooManyRequests);
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      // The reset page opens in the language the request was made in.
      redirectTo: `${env.siteUrl()}/auth/confirm?next=${localePath(locale, "/reset-password")}`,
    });
  } catch (err) {
    return failure(err, m.generic);
  }
  // Same response whether or not the account exists (no account enumeration).
  return { ok: true, message: m.resetSent };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const locale = localeOf(values);
  const m = messagesFor(locale);
  if (!isSupabaseConfigured()) return notConfigured(locale);
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub) {
      return { ok: false, message: m.resetExpired };
    }
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { ok: false, message: error.message };
  } catch (err) {
    return failure(err, m.generic);
  }
  redirect("/dashboard?passwordUpdated=1");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
