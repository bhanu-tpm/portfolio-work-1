import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, CalendarDays, CheckCircle2, ClipboardList, FileCheck2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireUser } from "@/lib/auth/dal";
import { isAiConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { appointmentStatusMeta, formatDateTime, requestStatusMeta } from "@/lib/format";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  type Appointment,
  type Notification,
  type RequestStatus,
} from "@/lib/db/types";
import { EmptyState, PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const sp = await searchParams;
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [requests, appointments, outcomes, notifications] = await Promise.all([
    supabase
      .from("consultation_requests")
      .select("id, reference_code, status, category:consultation_categories(title)")
      .eq("client_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(5),
    supabase
      .from("appointments")
      .select("*")
      .eq("client_id", user.id)
      .in("status", ACTIVE_APPOINTMENT_STATUSES)
      .gte("ends_at", nowIso)
      .order("starts_at")
      .limit(3),
    supabase
      .from("consultation_outcomes")
      .select("id, title, status")
      .eq("client_id", user.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const reqRows = (requests.data ?? []) as unknown as {
    id: string;
    reference_code: string;
    status: RequestStatus;
    category: { title: string } | null;
  }[];
  const actionNeeded = reqRows.filter((r) => r.status === "more_info_required" || r.status === "accepted");
  const firstName = user.profile?.full_name?.split(/\s+/)[0];

  return (
    <div className="grid gap-6">
      <PageHeader
        title={firstName ? `Welcome, ${firstName}` : "Welcome"}
        description="Your consultations at a glance."
        actions={
          <Button asChild>
            <Link href="/dashboard/requests/new">New consultation request</Link>
          </Button>
        }
      />

      {sp.passwordUpdated ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Your password has been updated.</AlertDescription>
        </Alert>
      ) : null}

      {actionNeeded.length ? (
        <div className="grid gap-3">
          {actionNeeded.map((r) => (
            <Link
              key={r.id}
              href={r.status === "accepted" ? `/dashboard/appointments/book?request=${r.id}` : `/dashboard/requests/${r.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border-l-4 border-warning bg-warning/5 p-4 text-sm hover:bg-warning/10"
            >
              <span>
                <strong>{r.category?.title ?? r.reference_code}:</strong>{" "}
                {r.status === "accepted" ? "your request was accepted — book your appointment." : "more information is needed."}
              </span>
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Upcoming appointments"
          actions={
            <Link href="/dashboard/appointments" className="text-xs text-teal underline">
              All appointments
            </Link>
          }
        >
          {(appointments.data as Appointment[] | null)?.length ? (
            <ul className="grid gap-3 text-sm">
              {(appointments.data as Appointment[]).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-teal" aria-hidden />
                    {formatDateTime(a.starts_at, a.timezone)}
                  </span>
                  <StatusBadge tone={appointmentStatusMeta[a.status].tone}>{appointmentStatusMeta[a.status].label}</StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
          )}
        </Section>

        <Section
          title="Recent requests"
          actions={
            <Link href="/dashboard/requests" className="text-xs text-teal underline">
              All requests
            </Link>
          }
        >
          {reqRows.length ? (
            <ul className="grid gap-3 text-sm">
              {reqRows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <Link href={`/dashboard/requests/${r.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                    <ClipboardList className="size-4 shrink-0 text-teal" aria-hidden />
                    <span className="truncate">{r.category?.title ?? r.reference_code}</span>
                  </Link>
                  <StatusBadge tone={requestStatusMeta[r.status].tone}>{requestStatusMeta[r.status].label}</StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="py-8" title="No requests yet" action={<Button asChild size="sm"><Link href="/dashboard/requests/new">Start a request</Link></Button>} />
          )}
        </Section>

        <Section title="Available outcomes">
          {outcomes.data?.length ? (
            <ul className="grid gap-3 text-sm">
              {outcomes.data.map((o) => (
                <li key={o.id}>
                  <Link href={`/dashboard/outcomes/${o.id}`} className="flex items-center gap-2 hover:underline">
                    <FileCheck2 className="size-4 text-teal" aria-hidden />
                    {o.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Your action plans will appear here after your consultation.</p>
          )}
        </Section>

        <Section title="Notifications">
          {(notifications.data as Notification[] | null)?.length ? (
            <ul className="grid gap-3 text-sm">
              {(notifications.data as Notification[]).map((n) => (
                <li key={n.id} className="flex gap-2">
                  <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    {n.link ? (
                      <Link href={n.link} className="hover:underline">
                        {n.subject}
                      </Link>
                    ) : (
                      <p>{n.subject}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )}
        </Section>
      </div>

      {isAiConfigured() ? (
        <Link
          href="/dashboard/assistant"
          className="flex items-center justify-between gap-4 rounded-xl bg-secondary/60 p-5 text-sm hover:bg-secondary"
        >
          <span className="flex items-center gap-3">
            <Sparkles className="size-5 text-teal" aria-hidden />
            <span>
              <strong>Explore options with the AI guidance assistant</strong>
              <span className="block text-muted-foreground">Optional — exploratory suggestions, not a substitute for your consultation.</span>
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
