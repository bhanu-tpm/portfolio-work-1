"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth/dal";
import { appointmentChangeRequestSchema, bookAppointmentSchema } from "@/lib/validation/schemas";
import { UserFacingError, failure, formValues, validationFailure, type ActionState } from "@/lib/action-result";
import { enforceRateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/email/notify";
import { getSettings } from "@/lib/settings";
import { validateSlot } from "@/lib/booking/service";
import {
  CHANGE_REQUEST_STATUS,
  CLIENT_CHANGEABLE_STATUSES,
  SLOT_TAKEN_MESSAGE,
  allowedFormats,
  bookingDuration,
  bookingErrorMessage,
  canClientRequestChange,
} from "@/lib/booking/rules";
import { formatDateTime, formatLabel, formatTimeZoneName } from "@/lib/format";
import { ACTIVE_APPOINTMENT_STATUSES, type Appointment } from "@/lib/db/types";

type RequestForBooking = {
  id: string;
  client_id: string;
  status: string;
  reference_code: string;
  full_name: string;
  category: { title: string; formats: string[]; duration_minutes: number | null } | null;
};

export async function bookAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = bookAppointmentSchema.safeParse(values);
  if (!parsed.success) {
    const failed = validationFailure(parsed.error, values);
    if (failed.fieldErrors?.startsAt) failed.fieldErrors.startsAt = ["Choose a time slot."];
    return failed;
  }
  const input = parsed.data;
  let bookedId: string | null = null;

  try {
    const user = await assertUser();
    await enforceRateLimit(`booking:${user.id}`, 10, 3600, "Too many booking attempts. Please wait a little and try again.");

    // Ownership + status are verified on the server; RLS limits the read to the user's own requests.
    const supabase = await createClient();
    const { data: request } = await supabase
      .from("consultation_requests")
      .select("id, client_id, status, reference_code, full_name, category:consultation_categories(title, formats, duration_minutes)")
      .eq("id", input.requestId)
      .maybeSingle<RequestForBooking>();
    if (!request || request.client_id !== user.id) throw new UserFacingError("Request not found.");
    if (request.status !== "accepted") throw new UserFacingError("Appointments can only be booked for accepted requests.");

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("appointments")
      .select("id")
      .eq("request_id", request.id)
      .in("status", ACTIVE_APPOINTMENT_STATUSES)
      .limit(1);
    if (existing?.length) throw new UserFacingError("This request already has an active appointment.");

    const settings = await getSettings("booking");
    const formats = allowedFormats(request.category?.formats, settings.formats);
    if (!formats.includes(input.format)) {
      return { ok: false, message: "Please choose an available format.", fieldErrors: { format: ["Choose an available format"] }, values };
    }

    // Re-validate the slot against fresh availability immediately before inserting.
    const durationMinutes = bookingDuration(request.category?.duration_minutes, settings.slotMinutes);
    const { slot, settings: fresh } = await validateSlot({ durationMinutes, startsAt: input.startsAt });
    if (!slot) {
      return { ok: false, message: SLOT_TAKEN_MESSAGE, fieldErrors: { startsAt: [SLOT_TAKEN_MESSAGE] }, values, data: { refresh: true } };
    }

    const { data: inserted, error } = await admin
      .from("appointments")
      .insert({
        request_id: request.id,
        client_id: user.id,
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        buffer_minutes: fresh.bufferMinutes,
        timezone: fresh.timezone,
        format: input.format,
        status: "pending",
        client_note: input.clientNote ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      const friendly = bookingErrorMessage(error?.code);
      if (friendly) return { ok: false, message: friendly, values, data: { refresh: true } };
      throw error ?? new Error("Insert failed");
    }
    bookedId = inserted.id;

    const when = `${formatDateTime(slot.startsAt, fresh.timezone)} (${formatTimeZoneName(fresh.timezone)})`;
    const appointmentId = inserted.id;
    after(async () => {
      await notify({
        type: "appointment.booked",
        userId: user.id,
        subject: `Appointment request received (${request.reference_code})`,
        heading: "Your appointment request has been received",
        paragraphs: [
          `You requested ${when} as a ${formatLabel(input.format).toLowerCase()}.`,
          "I'll confirm the appointment shortly. You'll receive the meeting details once it is confirmed.",
        ],
        link: "/dashboard/appointments",
        linkLabel: "View appointments",
        relatedRequestId: request.id,
        relatedAppointmentId: appointmentId,
      });
      await notify({
        type: "appointment.booked",
        subject: `New booking for ${request.reference_code}`,
        heading: "New appointment booked",
        paragraphs: [
          `${request.full_name} booked ${when} (${formatLabel(input.format)}).`,
          input.clientNote ? `Client note: ${input.clientNote}` : "No note was added.",
          "The appointment is awaiting your confirmation.",
        ],
        link: `/admin/appointments/${appointmentId}`,
        linkLabel: "Review appointment",
        relatedRequestId: request.id,
        relatedAppointmentId: appointmentId,
      });
    });
  } catch (err) {
    return { ...failure(err), values };
  }

  if (!bookedId) return { ok: false, message: "Something went wrong. Please try again.", values };
  revalidatePath("/dashboard/appointments");
  revalidatePath(`/dashboard/requests/${input.requestId}`);
  redirect("/dashboard/appointments?booked=1");
}

export async function requestAppointmentChange(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = appointmentChangeRequestSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  const { appointmentId, kind, reason } = parsed.data;

  try {
    const user = await assertUser();
    await enforceRateLimit(`appointment-change:${user.id}`, 10, 3600);

    const admin = createAdminClient();
    const { data: appointment } = await admin
      .from("appointments")
      .select("*, request:consultation_requests(reference_code)")
      .eq("id", appointmentId)
      .maybeSingle<Appointment & { request: { reference_code: string } | null }>();
    // Never trust the hidden id: the appointment must belong to the signed-in user.
    if (!appointment || appointment.client_id !== user.id) throw new UserFacingError("Appointment not found.");

    const check = canClientRequestChange(appointment);
    if (!check.allowed) throw new UserFacingError(check.reason);

    const nextStatus = CHANGE_REQUEST_STATUS[kind];
    const { data: updated, error } = await admin
      .from("appointments")
      .update({ status: nextStatus, change_request_reason: reason, change_requested_at: new Date().toISOString() })
      .eq("id", appointment.id)
      .eq("client_id", user.id)
      .in("status", CLIENT_CHANGEABLE_STATUSES)
      .select("id");
    if (error) throw error;
    if (!updated?.length) throw new UserFacingError("This appointment was just updated. Please refresh and try again.");

    const reference = appointment.request?.reference_code ?? "appointment";
    const when = `${formatDateTime(appointment.starts_at, appointment.timezone)} (${formatTimeZoneName(appointment.timezone)})`;
    after(() =>
      notify({
        type: "appointment.changed",
        subject: `${kind === "cancel" ? "Cancellation" : "Reschedule"} requested for ${reference}`,
        heading: kind === "cancel" ? "Client asked to cancel" : "Client asked to reschedule",
        paragraphs: [`Appointment: ${when}.`, `Reason: ${reason}`],
        link: `/admin/appointments/${appointment.id}`,
        linkLabel: "Review request",
        relatedRequestId: appointment.request_id,
        relatedAppointmentId: appointment.id,
      }),
    );

    revalidatePath("/dashboard/appointments");
    return {
      ok: true,
      message:
        kind === "cancel"
          ? "Cancellation requested. You'll be notified once it's processed."
          : "Reschedule requested. You'll be notified when a new time is set.",
    };
  } catch (err) {
    return { ...failure(err), values };
  }
}
