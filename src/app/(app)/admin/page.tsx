import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isAiConfigured, isEmailConfigured, isServiceRoleConfigured } from "@/lib/env";
import { appointmentStatusMeta, formatDateTime, requestStatusMeta } from "@/lib/format";
import { ACTIVE_APPOINTMENT_STATUSES, type Appointment, type RequestStatus } from "@/lib/db/types";
import { PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Overview" };

function Metric({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow hover:shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-3xl font-semibold text-primary">{value}</p>
    </Link>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const head = { count: "exact" as const, head: true };

  const [newReqs, reviewing, waitingInfo, accepted, upcoming, queue, changeRequests, failedEmails, recent, nextAppointments] =
    await Promise.all([
      supabase.from("consultation_requests").select("id", head).eq("status", "submitted"),
      supabase.from("consultation_requests").select("id", head).eq("status", "under_review"),
      supabase.from("consultation_requests").select("id", head).eq("status", "more_info_required"),
      supabase.from("consultation_requests").select("id", head).eq("status", "accepted"),
      supabase.from("appointments").select("id", head).in("status", ACTIVE_APPOINTMENT_STATUSES).gte("starts_at", nowIso),
      supabase.from("consultation_outcomes").select("id", head).in("status", ["draft", "approved"]),
      supabase.from("appointments").select("id", head).in("status", ["reschedule_requested", "cancellation_requested"]),
      supabase.from("notifications").select("id", head).eq("status", "failed"),
      supabase
        .from("consultation_requests")
        .select("id, reference_code, full_name, status, submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(6),
      supabase
        .from("appointments")
        .select("*, request:consultation_requests(full_name)")
        .in("status", ACTIVE_APPOINTMENT_STATUSES)
        .gte("starts_at", nowIso)
        .order("starts_at")
        .limit(6),
    ]);

  const warnings = [
    !isServiceRoleConfigured() && "Supabase service role key is missing — uploads, emails and AI records won't work.",
    !isEmailConfigured() && "Email is not configured — notifications are recorded but not sent.",
    !isAiConfigured() && "AI is disabled or not configured — all core features still work.",
  ].filter(Boolean) as string[];

  return (
    <div className="grid gap-6">
      <PageHeader title="Overview" description="What needs your attention today." />

      {warnings.length ? (
        <ul className="grid gap-2">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                {w}{" "}
                <Link href="/admin/settings" className="text-teal underline">
                  Settings
                </Link>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="New requests" value={newReqs.count ?? 0} href="/admin/requests?status=submitted" />
        <Metric label="Under review" value={reviewing.count ?? 0} href="/admin/requests?status=under_review" />
        <Metric label="Awaiting client info" value={waitingInfo.count ?? 0} href="/admin/requests?status=more_info_required" />
        <Metric label="Accepted" value={accepted.count ?? 0} href="/admin/requests?status=accepted" />
        <Metric label="Upcoming appointments" value={upcoming.count ?? 0} href="/admin/appointments" />
        <Metric label="Change requests" value={changeRequests.count ?? 0} href="/admin/appointments" />
        <Metric label="Outcomes to approve/publish" value={queue.count ?? 0} href="/admin/outcomes" />
        <Metric label="Failed emails" value={failedEmails.count ?? 0} href="/admin/notifications?status=failed" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Latest requests"
          actions={
            <Link href="/admin/requests" className="inline-flex items-center gap-1 text-xs text-teal underline">
              All <ArrowRight className="size-3" aria-hidden />
            </Link>
          }
        >
          {recent.data?.length ? (
            <ul className="grid gap-3 text-sm">
              {recent.data.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <Link href={`/admin/requests/${r.id}`} className="min-w-0 hover:underline">
                    <span className="block truncate">{r.full_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.reference_code} · {formatDateTime(r.submitted_at)}
                    </span>
                  </Link>
                  <StatusBadge tone={requestStatusMeta[r.status as RequestStatus].tone}>
                    {requestStatusMeta[r.status as RequestStatus].label}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          )}
        </Section>

        <Section
          title="Next appointments"
          actions={
            <Link href="/admin/appointments" className="inline-flex items-center gap-1 text-xs text-teal underline">
              All <ArrowRight className="size-3" aria-hidden />
            </Link>
          }
        >
          {nextAppointments.data?.length ? (
            <ul className="grid gap-3 text-sm">
              {(nextAppointments.data as (Appointment & { request: { full_name: string } | null })[]).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate">{a.request?.full_name}</span>
                    <span className="block text-xs text-muted-foreground">{formatDateTime(a.starts_at, a.timezone)}</span>
                  </span>
                  <StatusBadge tone={appointmentStatusMeta[a.status].tone}>{appointmentStatusMeta[a.status].label}</StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
