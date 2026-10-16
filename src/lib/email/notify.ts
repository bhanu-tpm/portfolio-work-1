import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";
import { env, isEmailConfigured, isServiceRoleConfigured } from "@/lib/env";
import { getSettings, type EmailSettings } from "@/lib/settings";
import { renderEmail } from "./template";

export type NotificationType =
  | "request.new"
  | "request.status"
  | "request.more_info"
  | "request.message"
  | "appointment.booked"
  | "appointment.changed"
  | "appointment.reminder"
  | "outcome.published"
  | "contact.new"
  | "account";

const SETTING_FOR_TYPE: Record<NotificationType, keyof EmailSettings | null> = {
  "request.new": "newRequest",
  "request.status": "statusChange",
  "request.more_info": "moreInfo",
  "request.message": "statusChange",
  "appointment.booked": "appointment",
  "appointment.changed": "appointment",
  "appointment.reminder": "reminders",
  "outcome.published": "outcomePublished",
  "contact.new": "contact",
  account: null,
};

export interface NotifyInput {
  type: NotificationType;
  /** Client recipient. Omit for administrator notifications. */
  userId?: string | null;
  to?: string | null;
  subject: string;
  heading: string;
  paragraphs: string[];
  /** Path within the site, e.g. /dashboard/requests/123 */
  link?: string;
  linkLabel?: string;
  relatedRequestId?: string;
  relatedAppointmentId?: string;
  relatedOutcomeId?: string;
}

/**
 * Records the notification and sends the email when configured.
 * Never throws: a failed email must not undo the underlying action.
 */
export async function notify(input: NotifyInput): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  try {
    const admin = createAdminClient();
    const isAdminNotification = !input.userId;
    let recipient = input.to ?? (isAdminNotification ? env.adminNotificationEmail() : undefined) ?? null;
    let wantsEmail = true;

    if (input.userId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("email, email_notifications")
        .eq("id", input.userId)
        .maybeSingle();
      recipient = recipient ?? profile?.email ?? null;
      wantsEmail = input.type === "account" || profile?.email_notifications !== false;
    }

    const settingKey = SETTING_FOR_TYPE[input.type];
    const emailSettings = await getSettings("email");
    const enabled = settingKey ? emailSettings[settingKey] : true;

    const { data: row, error: insertError } = await admin
      .from("notifications")
      .insert({
        user_id: input.userId ?? null,
        type: input.type,
        channel: "email",
        recipient_email: recipient,
        subject: input.subject,
        body: input.paragraphs.join("\n\n"),
        link: input.link ?? null,
        status: "queued",
        related_request_id: input.relatedRequestId ?? null,
        related_appointment_id: input.relatedAppointmentId ?? null,
        related_outcome_id: input.relatedOutcomeId ?? null,
      })
      .select("id")
      .single();
    if (insertError || !row) {
      console.error("[notify] could not record notification", insertError?.message);
      return;
    }

    const skip = async (reason: string) => {
      await admin.from("notifications").update({ status: "skipped", error: reason }).eq("id", row.id);
    };
    if (!enabled) return skip("Disabled in email settings");
    if (!wantsEmail) return skip("Recipient opted out of email");
    if (!recipient) return skip("No recipient address");
    if (!isEmailConfigured()) return skip("Email provider not configured");

    const url = input.link ? new URL(input.link, env.siteUrl()).toString() : undefined;
    const { html, text } = renderEmail({
      siteName: env.siteName(),
      heading: input.heading,
      paragraphs: input.paragraphs,
      cta: url ? { url, label: input.linkLabel ?? "Open" } : undefined,
    });

    const resend = new Resend(env.resendApiKey());
    const { data, error } = await resend.emails.send({
      from: env.emailFrom()!,
      to: recipient,
      subject: input.subject,
      html,
      text,
    });

    await admin
      .from("notifications")
      .update(
        error
          ? { status: "failed", error: error.message?.slice(0, 500) ?? "Unknown provider error" }
          : { status: "sent", provider_message_id: data?.id ?? null, sent_at: new Date().toISOString() },
      )
      .eq("id", row.id);
  } catch (err) {
    console.error("[notify] unexpected failure", err);
  }
}
