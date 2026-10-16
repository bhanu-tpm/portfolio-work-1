import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { appointmentStatusMeta, formatDateTime, formatLabel, formatTime, formatTimeZoneName } from "@/lib/format";
import type { Appointment } from "@/lib/db/types";
import { canClientRequestChange, splitAppointments } from "@/lib/booking/rules";
import { EmptyState, PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActionDialog } from "@/components/booking/action-dialog";
import { requestAppointmentChange } from "./actions";

export const metadata: Metadata = { title: "Appointments" };

type Row = Appointment & {
  request: { id: string; reference_code: string; category: { title: string } | null } | null;
};

export default async function AppointmentsPage({ searchParams }: PageProps<"/dashboard/appointments">) {
  const user = await requireUser("/dashboard/appointments");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, request:consultation_requests(id, reference_code, category:consultation_categories(title))")
    .eq("client_id", user.id)
    .order("starts_at", { ascending: true });

  const rows = (data ?? []) as unknown as Row[];
  const { upcoming, past } = splitAppointments(rows);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Appointments"
        description="Your booked consultations. Times are shown in the consultant's timezone."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/requests">Your requests</Link>
          </Button>
        }
      />

      {sp.booked ? (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Appointment requested</AlertTitle>
          <AlertDescription>
            Your booking is awaiting confirmation. You&apos;ll receive an email once it&apos;s confirmed.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Appointments could not be loaded</AlertTitle>
          <AlertDescription>Please refresh the page or try again later.</AlertDescription>
        </Alert>
      ) : null}

      <Section title="Upcoming" description="Pending and confirmed appointments.">
        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming appointments"
            description="Once a consultation request is accepted, you can book a time from the request page."
            action={
              <Button asChild>
                <Link href="/dashboard/requests">View requests</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3">
            {upcoming.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Past and cancelled">
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="grid gap-3">
            {past.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function AppointmentCard({ appointment: a }: { appointment: Row }) {
  const meta = appointmentStatusMeta[a.status];
  const tzLabel = formatTimeZoneName(a.timezone);
  const change = canClientRequestChange(a);
  return (
    <li className="rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">
            {formatDateTime(a.starts_at, a.timezone)} – {formatTime(a.ends_at, a.timezone)}{" "}
            <span className="text-sm font-normal text-muted-foreground">({tzLabel})</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {a.request?.category?.title ?? "Consultation"} · {formatLabel(a.format)}
            {a.request ? (
              <>
                {" · "}
                <Link href={`/dashboard/requests/${a.request.id}`} className="text-teal underline-offset-2 hover:underline">
                  {a.request.reference_code}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      </div>

      <div className="mt-3 grid gap-2 text-sm">
        {a.status === "confirmed" && a.meeting_details ? (
          <div className="rounded-md border-l-4 border-teal bg-accent/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Meeting details</p>
            <p className="mt-0.5 break-words whitespace-pre-wrap">{a.meeting_details}</p>
          </div>
        ) : null}
        {a.status === "pending" ? (
          <p className="text-muted-foreground">Meeting details will be shared once the appointment is confirmed.</p>
        ) : null}
        {a.client_note ? (
          <p>
            <span className="text-muted-foreground">Your note: </span>
            <span className="whitespace-pre-wrap">{a.client_note}</span>
          </p>
        ) : null}
        {(a.status === "reschedule_requested" || a.status === "cancellation_requested") && a.change_request_reason ? (
          <p>
            <span className="text-muted-foreground">Your request ({formatDateTime(a.change_requested_at, a.timezone)}): </span>
            <span className="whitespace-pre-wrap">{a.change_request_reason}</span>
          </p>
        ) : null}
        {a.status === "cancelled" && a.cancellation_reason ? (
          <p>
            <span className="text-muted-foreground">Cancellation reason: </span>
            <span className="whitespace-pre-wrap">{a.cancellation_reason}</span>
          </p>
        ) : null}
      </div>

      {change.allowed ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionDialog
            action={requestAppointmentChange}
            hidden={{ appointmentId: a.id, kind: "reschedule" }}
            fields={[{ name: "reason", label: "Why do you need a new time?", required: true, placeholder: "e.g. I have an exam that morning; afternoons next week work better." }]}
            triggerLabel="Request reschedule"
            title="Request a new time"
            description="The consultant will review your request and pick a new time. Your current slot stays reserved until then."
            confirmLabel="Send request"
            pendingLabel="Sending…"
          />
          <ActionDialog
            action={requestAppointmentChange}
            hidden={{ appointmentId: a.id, kind: "cancel" }}
            fields={[{ name: "reason", label: "Reason for cancelling", required: true }]}
            triggerLabel="Request cancellation"
            triggerVariant="ghost"
            title="Cancel this appointment?"
            description="Your cancellation request will be sent to the consultant for confirmation."
            confirmLabel="Request cancellation"
            confirmVariant="destructive"
            pendingLabel="Sending…"
          />
        </div>
      ) : null}
    </li>
  );
}
