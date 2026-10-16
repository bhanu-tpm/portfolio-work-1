"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth/dal";
import { profileSchema } from "@/lib/validation/schemas";
import { failure, formValues, validationFailure, type ActionState } from "@/lib/action-result";

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    const user = await assertUser();
    const input = parsed.data;
    const hadConsent = Boolean(user.profile?.ai_consent);

    const update: Record<string, unknown> = {
      full_name: input.fullName,
      phone: input.phone ?? null,
      education_status: input.educationStatus ?? null,
      organization: input.organization ?? null,
      course: input.course ?? null,
      email_notifications: input.emailNotifications,
      ai_consent: input.aiConsent,
    };
    // Record when consent is given; clear the timestamp when it is withdrawn.
    if (input.aiConsent && !hadConsent) update.ai_consent_at = new Date().toISOString();
    if (!input.aiConsent) update.ai_consent_at = null;

    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    if (error) throw error;

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/assistant");
    return {
      ok: true,
      message:
        hadConsent && !input.aiConsent
          ? "Saved. AI consent withdrawn — the assistant is disabled until you agree again. Use “Clear AI assistant history” below to delete past conversations."
          : "Your profile has been saved.",
    };
  } catch (err) {
    return { ...failure(err), values };
  }
}
