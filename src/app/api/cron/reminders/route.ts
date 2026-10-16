import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { env, isServiceRoleConfigured } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/email/notify";
import { removeObjects } from "@/lib/storage";
import { formatDateTime, formatLabel, formatTimeZoneName } from "@/lib/format";
import type { Appointment } from "@/lib/db/types";

/**
 * Scheduled job (Vercel Cron): appointment reminders + data retention.
 * Protected by `Authorization: Bearer ${CRON_SECRET}`.
 */

function authorized(header: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const secret = env.cronSecret();
  if (!secret) return json({ error: "CRON_SECRET is not configured" }, 503);
  if (!authorized(request.headers.get("authorization"), secret)) return json({ error: "Unauthorized" }, 401);
  if (!isServiceRoleConfigured()) return json({ error: "Supabase service role is not configured" }, 503);

  const reminders = await sendReminders();
  const retention = await applyRetention();
  return json({ ok: !reminders.error && !retention.error, ranAt: new Date().toISOString(), reminders, retention });
}

async function sendReminders() {
  const admin = createAdminClient();
  const settings = await getSettings("booking");
  const now = new Date();
  const until = new Date(now.getTime() + settings.reminderHoursBefore * 3_600_000);

  const { data, error } = await admin
    .from("appointments")
    .select("*, request:consultation_requests(reference_code)")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gt("starts_at", now.toISOString())
    .lte("starts_at", until.toISOString())
    .order("starts_at")
    .limit(200);
  if (error) {
    console.error("[cron] reminder query failed", error.message);
    return { candidates: 0, sent: 0, error: "query_failed" };
  }

  let sent = 0;
  for (const a of (data ?? []) as (Appointment & { request: { reference_code: string } | null })[]) {
    // Claim the reminder first so overlapping cron runs never send it twice.
    const { data: claimed } = await admin
      .from("appointments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", a.id)
      .eq("status", "confirmed")
      .is("reminder_sent_at", null)
      .select("id");
    if (!claimed?.length) continue;

    const when = `${formatDateTime(a.starts_at, a.timezone)} (${formatTimeZoneName(a.timezone)})`;
    await notify({
      type: "appointment.reminder",
      userId: a.client_id,
      subject: `Reminder: your consultation on ${formatDateTime(a.starts_at, a.timezone)}`,
      heading: "Your consultation is coming up",
      paragraphs: [
        `This is a reminder of your appointment on ${when} · ${formatLabel(a.format)}.`,
        a.meeting_details ? `Meeting details: ${a.meeting_details}` : "Meeting details are available in your dashboard.",
        "If you can no longer attend, please request a reschedule or cancellation from your dashboard.",
      ],
      link: "/dashboard/appointments",
      linkLabel: "View appointment",
      relatedRequestId: a.request_id,
      relatedAppointmentId: a.id,
    });
    sent++;
  }
  return { candidates: data?.length ?? 0, sent };
}

async function applyRetention() {
  const admin = createAdminClient();
  const privacy = await getSettings("privacy");
  const cutoff = new Date(Date.now() - privacy.resumeRetentionDays * 86_400_000).toISOString();

  // 1. Resume files referenced only by reviews past retention.
  let filesDeleted = 0;
  const { data: oldReviews, error: reviewError } = await admin
    .from("resume_reviews")
    .select("file_id")
    .lt("created_at", cutoff)
    .not("file_id", "is", null)
    .limit(500);
  if (reviewError) console.error("[cron] resume review query failed", reviewError.message);

  const candidateIds = [...new Set((oldReviews ?? []).map((r) => r.file_id as string))];
  if (candidateIds.length) {
    const { data: stillUsed } = await admin
      .from("resume_reviews")
      .select("file_id")
      .in("file_id", candidateIds)
      .gte("created_at", cutoff);
    const keep = new Set((stillUsed ?? []).map((r) => r.file_id as string));
    const { data: files } = await admin
      .from("files")
      .select("id, bucket, path")
      .in("id", candidateIds.filter((id) => !keep.has(id)))
      .eq("purpose", "resume");

    const byBucket = new Map<string, { ids: string[]; paths: string[] }>();
    for (const f of files ?? []) {
      const entry = byBucket.get(f.bucket) ?? { ids: [], paths: [] };
      entry.ids.push(f.id);
      entry.paths.push(f.path);
      byBucket.set(f.bucket, entry);
    }
    for (const [bucket, { ids, paths }] of byBucket) {
      await removeObjects(bucket, paths);
      const { error } = await admin.from("files").delete().in("id", ids);
      if (error) console.error("[cron] file metadata delete failed", error.message);
      else filesDeleted += ids.length;
    }
  }

  // 2. Database rows (assistant history, AI run metadata, resume reviews).
  const { data, error } = await admin.rpc("apply_retention", {
    assistant_days: privacy.assistantRetentionDays,
    ai_run_days: privacy.aiRunRetentionDays,
    resume_days: privacy.resumeRetentionDays,
  });
  if (error) {
    console.error("[cron] apply_retention failed", error.message);
    return { filesDeleted, error: "apply_retention_failed" };
  }
  return { filesDeleted, deleted: data as Record<string, number> };
}
