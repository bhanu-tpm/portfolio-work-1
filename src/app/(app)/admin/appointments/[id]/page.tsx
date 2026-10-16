import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { Appointment } from "@/lib/db/types";
import { appointmentStatusMeta, formatDateTime, formatLabel, formatTime, formatTimeZoneName } from "@/lib/format";
import { adminActionsFor } from "@/lib/booking/rules";
import { getAvailableSlots } from "@/lib/booking/service";
import { buildSlotGroups } from "@/lib/booking/display";
import { DefinitionList, PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActionDialog } from "@/components/booking/action-dialog";
import { cancelAppointment, resolveChangeRequest, setAppointmentOutcome } from "../actions";
import { ConfirmForm, RescheduleForm } from "./forms";

export const metadata: Metadata = { title: "Appointment" };

type Detail = Appointment & {
  client: { full_name: string; email: string; phone: string | null } | null;
  request: { id: string; reference_code: string; category: { title: string } | null } | null;
};

export default async function AdminAppointmentPage({ params }: PageProps<"/admin/appointments/[id]">) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select(
      "*, client:profiles!appointments_client_id_fkey(full_name, email, phone), request:consultation_requests(id, reference_code, category:consultation_categories(title))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const a = data as unknown as Detail;

  const meta = appointmentStatusMeta[a.status];
  const actions = adminActionsFor(a.status);
  const tz = `${formatTimeZoneName(a.timezone)} · ${a.timezone}`;

  let slotGroups: ReturnType<typeof buildSlotGroups> = [];
  let slotsError = false;
  let slotsTimezone = a.timezone;
  if (actions.includes("reschedule")) {
    try {
      const duration = Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60_000);
      const { slots, settings } = await getAvailableSlots({ durationMinutes: duration, excludeAppointmentId: a.id, minNoticeHours: 0 });
      slotsTimezone = settings.timezone;
      slotGroups = buildSlotGroups(slots, settings.timezone);
    } catch (err) {
      console.error("[admin appointments] slots unavailable", err);
      slotsError = true;
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/appointments">
            <ArrowLeft data-icon="inline-start" /> All appointments
          </Link>
        </Button>
      </div>
      <PageHeader
        eyebrow={a.request?.reference_code}
        title={`${formatDateTime(a.starts_at, a.timezone)} – ${formatTime(a.ends_at, a.timezone)}`}
        description={`${a.request?.category?.title ?? "Consultation"} · ${formatLabel(a.format)} · ${tz}`}
        actions={<StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>}
      />

      {a.status === "reschedule_requested" || a.status === "cancellation_requested" ? (
        <Section
          title={a.status === "cancellation_requested" ? "Client asked to cancel" : "Client asked to reschedule"}
          description={`Requested ${formatDateTime(a.change_requested_at, a.timezone)}`}
          className="ring-warning/40"
        >
          <p className="text-sm whitespace-pre-wrap">{a.change_request_reason || "No reason given."}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.includes("approve_cancellation") ? (
              <ActionDialog
                action={resolveChangeRequest}
                hidden={{ appointmentId: a.id, decision: "approve_cancellation" }}
                fields={[{ name: "message", label: "Message to the client (optional)" }]}
                triggerLabel="Approve cancellation"
                triggerVariant="destructive"
                title="Approve the cancellation?"
                description="The appointment will be cancelled and the slot released. The client is notified."
                confirmLabel="Cancel appointment"
                confirmVariant="destructive"
              />
            ) : null}
            {actions.includes("dismiss_change") ? (
              <ActionDialog
                action={resolveChangeRequest}
                hidden={{ appointmentId: a.id, decision: "dismiss" }}
                fields={[{ name: "message", label: "Message to the client (optional)" }]}
                triggerLabel="Keep current time"
                title="Dismiss the change request?"
                description="The appointment stays at its current time. The client is notified."
                confirmLabel="Keep appointment"
              />
            ) : null}
          </div>
          {a.status === "reschedule_requested" ? (
            <p className="mt-3 text-sm text-muted-foreground">To accept, pick a new time in “Reschedule” below.</p>
          ) : null}
        </Section>
      ) : null}

      <Section title="Details">
        <DefinitionList
          items={[
            { label: "Client", value: a.client?.full_name || "—" },
            { label: "Email", value: a.client?.email },
            { label: "Phone", value: a.client?.phone },
            {
              label: "Request",
              value: a.request ? (
                <Link href={`/admin/requests/${a.request.id}`} className="text-teal underline-offset-2 hover:underline">
                  {a.request.reference_code}
                </Link>
              ) : null,
            },
            { label: "Format", value: formatLabel(a.format) },
            { label: "Buffer after", value: `${a.buffer_minutes} min` },
            { label: "Client note", value: a.client_note },
            { label: "Meeting details", value: a.meeting_details },
            { label: "Confirmed", value: a.confirmed_at ? formatDateTime(a.confirmed_at, a.timezone) : null },
            { label: "Reminder sent", value: a.reminder_sent_at ? formatDateTime(a.reminder_sent_at, a.timezone) : null },
            { label: "Cancelled", value: a.cancelled_at ? formatDateTime(a.cancelled_at, a.timezone) : null },
            { label: "Cancellation reason", value: a.cancellation_reason },
            { label: "Completed", value: a.completed_at ? formatDateTime(a.completed_at, a.timezone) : null },
          ]}
        />
      </Section>

      {actions.includes("confirm") || actions.includes("update_details") ? (
        <Section
          title={actions.includes("confirm") ? "Confirm appointment" : "Meeting details"}
          description="Share a meeting link, phone number or address. The client sees this once confirmed."
        >
          <ConfirmForm appointmentId={a.id} meetingDetails={a.meeting_details} mode={actions.includes("confirm") ? "confirm" : "update"} />
        </Section>
      ) : null}

      {actions.includes("reschedule") ? (
        <Section title="Reschedule" description="Pick a new available time. The appointment is confirmed at the new time and the client is notified.">
          {slotsError ? (
            <p className="text-sm text-destructive">Availability couldn&apos;t be loaded. Please refresh.</p>
          ) : slotGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No free slots in the booking horizon. Adjust{" "}
              <Link href="/admin/availability" className="text-teal underline">
                availability
              </Link>{" "}
              to add times.
            </p>
          ) : (
            <RescheduleForm
              appointmentId={a.id}
              groups={slotGroups}
              timezoneLabel={`${formatTimeZoneName(slotsTimezone)} · ${slotsTimezone}`}
              meetingDetails={a.meeting_details}
            />
          )}
        </Section>
      ) : null}

      {actions.some((x) => x === "cancel" || x === "complete" || x === "no_show") ? (
        <Section title="Status">
          <div className="flex flex-wrap gap-2">
            {actions.includes("complete") ? (
              <ActionDialog
                action={setAppointmentOutcome}
                hidden={{ appointmentId: a.id, status: "completed" }}
                triggerLabel="Mark completed"
                triggerVariant="default"
                title="Mark as completed?"
                description="Use this after the session took place. The client is notified."
                confirmLabel="Mark completed"
              />
            ) : null}
            {actions.includes("no_show") ? (
              <ActionDialog
                action={setAppointmentOutcome}
                hidden={{ appointmentId: a.id, status: "no_show" }}
                triggerLabel="Mark no-show"
                title="Mark as no-show?"
                description="The client didn't attend. The slot is released and the client is notified."
                confirmLabel="Mark no-show"
                confirmVariant="destructive"
              />
            ) : null}
            {actions.includes("cancel") ? (
              <ActionDialog
                action={cancelAppointment}
                hidden={{ appointmentId: a.id }}
                fields={[{ name: "reason", label: "Reason (shared with the client)", required: true }]}
                triggerLabel="Cancel appointment"
                triggerVariant="destructive"
                title="Cancel this appointment?"
                description="The slot is released and the client is notified with your reason. This can't be undone."
                confirmLabel="Cancel appointment"
                confirmVariant="destructive"
              />
            ) : null}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
