"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { contactSchema } from "@/lib/validation/schemas";
import { failure, formValues, validationFailure, type ActionState } from "@/lib/action-result";
import { clientFingerprint, enforceRateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/email/notify";
import { isServiceRoleConfigured } from "@/lib/env";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";

export async function submitContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  // Server Actions can't read root params: the form sends its locale as a hidden field.
  const locale = isLocale(values.locale) ? values.locale : DEFAULT_LOCALE;
  const t = dictionaries[locale].contact.messages;
  const success: ActionState = { ok: true, message: t.success };

  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    // A filled honeypot is a bot: pretend success without storing anything.
    if (values.website) return success;
    return validationFailure(parsed.error, values);
  }
  const input = parsed.data;

  // Bots typically submit instantly.
  if (Date.now() - input.startedAt < 3000) return success;

  try {
    if (!isServiceRoleConfigured()) {
      return { ok: false, message: t.unavailable };
    }
    const fingerprint = await clientFingerprint();
    await enforceRateLimit(`contact:${fingerprint}`, 5, 3600, t.rateLimited);

    const { error } = await createAdminClient().from("contact_messages").insert({
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
    });
    if (error) throw error;

    // Admin notification stays in English (the admin area is not localised).
    await notify({
      type: "contact.new",
      subject: `New contact message: ${input.subject}`,
      heading: "New contact form message",
      paragraphs: [`From: ${input.name} <${input.email}>`, input.message],
      link: "/admin/messages",
      linkLabel: "View messages",
    });
    return success;
  } catch (err) {
    return { ...failure(err, dictionaries[locale].validation.messages.generic), values };
  }
}
