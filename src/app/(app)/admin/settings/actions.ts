"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth/dal";
import { aiSettingsSchema, emailSettingsSchema, privacySettingsSchema, type SettingsKey } from "@/lib/settings";
import { UserFacingError, failure, formValues, type ActionState } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import {
  aiSettingsFromForm,
  emailSettingsFromForm,
  privacySettingsFromForm,
  type FieldErrors,
} from "@/lib/validation/admin";
import { z } from "zod";

function invalid(fieldErrors: FieldErrors, values: Record<string, string>): ActionState {
  return { ok: false, message: "Please correct the highlighted fields.", fieldErrors, values };
}

/** Upserts one settings row as the admin (RLS: authorize('settings.manage')) and audits it. */
async function saveSettings(key: SettingsKey, value: Record<string, unknown>) {
  const user = await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_by: user.id }, { onConflict: "key" });
  if (error) {
    console.error("[settings] save failed", key, error.message);
    throw new UserFacingError("Settings couldn't be saved. Please try again.");
  }
  await audit(user.id, "settings.updated", "app_settings", key, { key, value });
  revalidatePath("/admin/settings");
}

export async function saveEmailSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = emailSettingsSchema.safeParse(emailSettingsFromForm(values));
  if (!parsed.success) return invalid(z.flattenError(parsed.error).fieldErrors as FieldErrors, values);
  try {
    await saveSettings("email", parsed.data);
    return { ok: true, message: "Email notification settings saved." };
  } catch (err) {
    return { ...failure(err), values };
  }
}

export async function saveAiSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const { data, errors } = aiSettingsFromForm(values);
  if (Object.keys(errors).length) return invalid(errors, values);
  const parsed = aiSettingsSchema.safeParse(data);
  if (!parsed.success) return invalid(z.flattenError(parsed.error).fieldErrors as FieldErrors, values);
  try {
    await saveSettings("ai", parsed.data);
    return { ok: true, message: "AI settings saved." };
  } catch (err) {
    return { ...failure(err), values };
  }
}

export async function savePrivacySettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const { data, errors } = privacySettingsFromForm(values);
  if (Object.keys(errors).length) return invalid(errors, values);
  const parsed = privacySettingsSchema.safeParse(data);
  if (!parsed.success) return invalid(z.flattenError(parsed.error).fieldErrors as FieldErrors, values);
  try {
    await saveSettings("privacy", parsed.data);
    return { ok: true, message: "Privacy and retention settings saved." };
  } catch (err) {
    return { ...failure(err), values };
  }
}
