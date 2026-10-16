import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  appointmentStatusMeta,
  formatDate,
  formatDateTime,
  formatLabel,
  outcomeStatusMeta,
  requestStatusMeta,
} from "@/lib/format";
import type {
  AppRole,
  Appointment,
  ConsultationOutcome,
  ConsultationRequest,
  Notification,
  Profile,
} from "@/lib/db/types";
import { isUuid } from "@/lib/validation/admin";
import { DefinitionList, PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { QueryError } from "@/components/admin-ops/filters";
import { notificationStatusMeta } from "../../notifications/meta";

export const metadata: Metadata = { title: "Client" };

type RequestRow = Pick<ConsultationRequest, "id" | "reference_code" | "status" | "submitted_at" | "consent_ai"> & {
  category: { title: string } | null;
};
type AppointmentRow = Pick<Appointment, "id" | "request_id" | "starts_at" | "status" | "format" | "timezone">;
type OutcomeRow = Pick<ConsultationOutcome, "id" | "request_id" | "title" | "status" | "published_at" | "updated_at">;
type NotificationRow = Pick<
  Notification,
  "id" | "type" | "channel" | "subject" | "status" | "error" | "created_at" | "sent_at"
>;

export default async function ClientDetailPage({ params }: PageProps<"/admin/clients/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle<Profile>();
  if (profileError) {
    console.error("[admin/clients] profile failed", profileError.message);
    return (
      <>
        <PageHeader title="Client" />
        <QueryError what="this client" />
      </>
    );
  }
  if (!profile) notFound();

  const [roles, requests, appointments, outcomes, notifications] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", id),
    supabase
      .from("consultation_requests")
      .select("id, reference_code, status, submitted_at, consent_ai, category:consultation_categories(title)")
      .eq("client_id", id)
      .order("submitted_at", { ascending: false })
      .limit(50),
    supabase
      .from("appointments")
      .select("id, request_id, starts_at, status, format, timezone")
      .eq("client_id", id)
      .order("starts_at", { ascending: false })
      .limit(50),
    supabase
      .from("consultation_outcomes")
      .select("id, request_id, title, status, published_at, updated_at")
      .eq("client_id", id)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("notifications")
      .select("id, type, channel, subject, status, error, created_at, sent_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  for (const [name, res] of Object.entries({ requests, appointments, outcomes, notifications })) {
    if (res.error) console.error(`[admin/clients] ${name} failed`, res.error.message);
  }

  const roleList = (roles.data ?? []).map((r) => r.role as AppRole);
  const requestRows = (requests.data ?? []) as unknown as RequestRow[];
  const appointmentRows = (appointments.data ?? []) as AppointmentRow[];
  const outcomeRows = (outcomes.data ?? []) as OutcomeRow[];
  const notificationRows = (notifications.data ?? []) as NotificationRow[];
  const referenceFor = new Map(requestRows.map((r) => [r.id, r.reference_code]));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/clients">
          <ArrowLeft data-icon="inline-start" aria-hidden /> All clients
        </Link>
      </Button>
      <PageHeader
        title={profile.full_name || "Unnamed client"}
        description={profile.email}
        eyebrow={roleList.includes("admin") ? "Administrator account" : "Client"}
      />

      <div className="grid gap-6">
        <Section title="Profile">
          <DefinitionList
            items={[
              { label: "Email", value: profile.email },
              { label: "Phone", value: profile.phone },
              { label: "Education status", value: profile.education_status },
              { label: "Organisation", value: profile.organization },
              { label: "Course", value: profile.course },
              { label: "Timezone", value: profile.timezone },
              { label: "Joined", value: formatDateTime(profile.created_at) },
              { label: "Roles", value: roleList.join(", ") },
            ]}
          />
        </Section>

        <Section title="Consent" description="As currently set by the client in their account settings.">
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm">
                AI assistance
                {profile.ai_consent_at ? (
                  <span className="block text-xs text-muted-foreground">
                    Given {formatDateTime(profile.ai_consent_at)}
                  </span>
                ) : null}
              </span>
              <StatusBadge tone={profile.ai_consent ? "success" : "neutral"}>
                {profile.ai_consent ? "Consented" : "Not consented"}
              </StatusBadge>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm">Email notifications</span>
              <StatusBadge tone={profile.email_notifications ? "success" : "neutral"}>
                {profile.email_notifications ? "On" : "Off"}
              </StatusBadge>
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Per-request AI consent is shown with each request below; it is what the intake analysis respects.
          </p>
        </Section>

        <Section title={`Requests (${requestRows.length})`}>
          {requests.error ? (
            <QueryError what="requests" />
          ) : requestRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No consultation requests yet.</p>
          ) : (
            <ul className="divide-y">
              {requestRows.map((r) => {
                const meta = requestStatusMeta[r.status];
                return (
                  <li key={r.id}>
                    <Link
                      href={`/admin/requests/${r.id}`}
                      className="flex flex-col gap-2 py-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{r.category?.title ?? "Consultation"}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.reference_code} · Submitted {formatDate(r.submitted_at)} · AI consent{" "}
                          {r.consent_ai ? "yes" : "no"}
                        </p>
                      </div>
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title={`Appointments (${appointmentRows.length})`}>
          {appointments.error ? (
            <QueryError what="appointments" />
          ) : appointmentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments yet.</p>
          ) : (
            <ul className="divide-y">
              {appointmentRows.map((a) => {
                const meta = appointmentStatusMeta[a.status];
                const ref = referenceFor.get(a.request_id);
                return (
                  <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{formatDateTime(a.starts_at, a.timezone)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatLabel(a.format)}
                        {ref ? (
                          <>
                            {" · "}
                            <Link href={`/admin/requests/${a.request_id}`} className="underline">
                              {ref}
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title={`Outcomes (${outcomeRows.length})`}>
          {outcomes.error ? (
            <QueryError what="outcomes" />
          ) : outcomeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outcomes yet.</p>
          ) : (
            <ul className="divide-y">
              {outcomeRows.map((o) => {
                const meta = outcomeStatusMeta[o.status];
                const ref = referenceFor.get(o.request_id);
                return (
                  <li key={o.id}>
                    <Link
                      href={`/admin/outcomes/${o.id}`}
                      className="flex flex-col gap-2 py-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{o.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {ref ? `${ref} · ` : ""}
                          {o.published_at ? `Published ${formatDate(o.published_at)}` : `Updated ${formatDate(o.updated_at)}`}
                        </p>
                      </div>
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          title="Recent notifications"
          description="The last 20 notifications for this client, with email delivery status."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/notifications">All notifications</Link>
            </Button>
          }
        >
          {notifications.error ? (
            <QueryError what="notifications" />
          ) : notificationRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="divide-y">
              {notificationRows.map((n) => {
                const meta = notificationStatusMeta[n.status];
                return (
                  <li key={n.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium break-words">{n.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.type} · {n.channel === "email" ? "Email" : "In-app"} · {formatDateTime(n.created_at)}
                      </p>
                      {n.error ? <p className="mt-1 text-xs break-words text-destructive">{n.error}</p> : null}
                    </div>
                    <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
