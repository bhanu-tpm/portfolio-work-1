"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { notify, type NotificationType } from "@/lib/email/notify";
import { UserFacingError, failure, formValues, validationFailure, type ActionState } from "@/lib/action-result";
import {
  appointmentOutcomeSchema,
  cancelAppointmentSchema,
  confirmAppointmentSchema,
  rescheduleAppointmentSchema,
  resolveChangeRequestSchema,
} from "@/lib/validation/booking";
import { SLOT_TAKEN_MESSAGE, adminActionsFor, bookingErrorMessage, statusAfterDismiss, type AdminAction } from "@/lib/booking/rules";
import { validateSlot } from "@/lib/booking/service";
import { formatDateTime, formatLabel, formatTimeZoneName } from "@/lib/format";
import type { Appointment, AppointmentStatus } from "@/lib/db/types";

type AdminAppointment = Appointment & { request: { reference_code: string } | null };

async function loadAppointment(
  id: string,
  action: AdminAction | ((status: AppointmentStatus) => AdminAction),
): Promise<AdminAppointment> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("*, request:consultation_requests(reference_code)")
    .eq("id", id)
    .maybeSingle<AdminAppointment>();
  if (!data) throw new UserFacingError("Appointment not found.");
  const required = typeof action === "function" ? action(data.status) : action;
  if (!adminActionsFor(data.status).includes(required)) {
    throw new UserFacingError("This action isn't available for the appointment's current status. Please refresh.");
  }
  return data;
}

/** Conditional update: only applies if the status hasn't changed since it was read. */
async function updateAppointment(current: AdminAppointment, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update(patch)
    .eq("id", current.id)
    .eq("status", current.status)
    .select("id");
  if (error) {
    const friendly = bookingErrorMessage(error.code);
    if (friendly) throw new UserFacingError(friendly);
    throw error;
  }
  if (!data?.length) throw new UserFacingError("This appointment was changed in the meantime. Please refresh and try again.");
}

function when(startsAt: string, timezone: string) {
  return `${formatDateTime(startsAt, timezone)} (${formatTimeZoneName(timezone)})`;
}

function notifyClient(
  appointment: AdminAppointment,
  type: NotificationType,
  subject: string,
  heading: string,
  paragraphs: string[],
) {
  after(() =>
    notify({
      type,
      userId: appointment.client_id,
      subject: `${subject}${appointment.request ? ` (${appointment.request.reference_code})` : ""}`,
      heading,
      paragraphs,
      link: "/dashboard/appointments",
      linkLabel: "View appointment",
      relatedRequestId: appointment.request_id,
      relatedAppointmentId: appointment.id,
    }),
  );
}

function revalidate(id: string) {
  revalidatePath("/admin/appointments");
  revalidatePath(`/admin/appointments/${id}`);
  revalidatePath("/dashboard/appointments");
}

export async function confirmAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = confirmAppointmentSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  const { appointmentId, meetingDetails } = parsed.data;
  try {
    const user = await assertAdmin();
    const appointment = await loadAppointment(appointmentId, (s) => (s === "confirmed" ? "update_details" : "confirm"));
    const isUpdate = appointment.status === "confirmed";

    await updateAppointment(
      appointment,
      isUpdate
        ? { meeting_details: meetingDetails ?? null }
        : { status: "confirmed", confirmed_at: new Date().toISOString(), meeting_details: meetingDetails ?? null },
    );
    await audit(user.id, isUpdate ? "appointment.details_updated" : "appointment.confirmed", "appointment", appointment.id, {
      hasMeetingDetails: Boolean(meetingDetails),
    });

    const time = when(appointment.starts_at, appointment.timezone);
    notifyClient(
      appointment,
      isUpdate ? "appointment.changed" : "appointment.booked",
      isUpdate ? "Meeting details updated" : "Your appointment is confirmed",
      isUpdate ? "Meeting details updated" : "Your appointment is confirmed",
      [
        `Appointment: ${time} · ${formatLabel(appointment.format)}.`,
        meetingDetails ? `Meeting details: ${meetingDetails}` : "Meeting details will follow before the session.",
      ],
    );
    revalidate(appointment.id);
    return { ok: true, message: isUpdate ? "Meeting details saved." : "Appointment confirmed." };
  } catch (err) {
    return { ...failure(err), values };
  }
}

export async function rescheduleAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = rescheduleAppointmentSchema.safeParse(values);
  if (!parsed.success) {
    const failed = validationFailure(parsed.error, values);
    if (failed.fieldErrors?.startsAt) failed.fieldErrors.startsAt = ["Choose a new time slot."];
    return failed;
  }
  const { appointmentId, startsAt, meetingDetails, message } = parsed.data;
  try {
    const user = await assertAdmin();
    const appointment = await loadAppointment(appointmentId, "reschedule");
    const durationMinutes = Math.round(
      (new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60_000,
    );

    // Same deterministic engine as client bookings, ignoring this appointment's own range.
    // The administrator may move a booking inside the client minimum-notice window.
    const { slot, settings } = await validateSlot({
      durationMinutes,
      startsAt,
      excludeAppointmentId: appointment.id,
      minNoticeHours: 0,
    });
    if (!slot) {
      return { ok: false, message: SLOT_TAKEN_MESSAGE, fieldErrors: { startsAt: [SLOT_TAKEN_MESSAGE] }, values, data: { refresh: true } };
    }

    const nowIso = new Date().toISOString();
    try {
      await updateAppointment(appointment, {
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        buffer_minutes: settings.bufferMinutes,
        timezone: settings.timezone,
        status: "confirmed",
        confirmed_at: appointment.confirmed_at ?? nowIso,
        meeting_details: meetingDetails ?? appointment.meeting_details,
        change_request_reason: null,
        change_requested_at: null,
        reminder_sent_at: null,
      });
    } catch (err) {
      if (err instanceof UserFacingError && err.message === SLOT_TAKEN_MESSAGE) {
        return { ok: false, message: SLOT_TAKEN_MESSAGE, values, data: { refresh: true } };
      }
      throw err;
    }

    await audit(user.id, "appointment.rescheduled", "appointment", appointment.id, {
      from: appointment.starts_at,
      to: slot.startsAt,
      previousStatus: appointment.status,
    });
    notifyClient(appointment, "appointment.changed", "Your appointment has a new time", "Your appointment has been rescheduled", [
      `New time: ${when(slot.startsAt, settings.timezone)} · ${formatLabel(appointment.format)}.`,
      `Previous time: ${when(appointment.starts_at, appointment.timezone)}.`,
      ...(message ? [message] : []),
      ...(meetingDetails ?? appointment.meeting_details ? [`Meeting details: ${meetingDetails ?? appointment.meeting_details}`] : []),
    ]);
    revalidate(appointment.id);
    return { ok: true, message: "Appointment rescheduled and confirmed." };
  } catch (err) {
    return { ...failure(err), values };
  }
}

export async function cancelAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = cancelAppointmentSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  const { appointmentId, reason } = parsed.data;
  try {
    const user = await assertAdmin();
    const appointment = await loadAppointment(appointmentId, "cancel");
    await updateAppointment(appointment, {
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    });
    await audit(user.id, "appointment.cancelled", "appointment", appointment.id, { previousStatus: appointment.status });
    notifyClient(appointment, "appointment.changed", "Your appointment was cancelled", "Your appointment was cancelled", [
      `The appointment on ${when(appointment.starts_at, appointment.timezone)} has been cancelled.`,
      `Reason: ${reason}`,
    ]);
    revalidate(appointment.id);
    return { ok: true, message: "Appointment cancelled." };
  } catch (err) {
    return { ...failure(err), values };
  }
}

export async function setAppointmentOutcome(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = appointmentOutcomeSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  const { appointmentId, status } = parsed.data;
  try {
    const user = await assertAdmin();
    const appointment = await loadAppointment(appointmentId, status === "completed" ? "complete" : "no_show");
    await updateAppointment(appointment, {
      status,
      ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
    });
    await audit(user.id, `appointment.${status}`, "appointment", appointment.id, { previousStatus: appointment.status });
    notifyClient(
      appointment,
      "appointment.changed",
      status === "completed" ? "Thank you for your session" : "We missed you at your appointment",
      status === "completed" ? "Your session is complete" : "Missed appointment",
      status === "completed"
        ? ["Thank you for attending. Your consultation outcome will be shared in your dashboard once it's ready."]
        : [
            `The appointment on ${when(appointment.starts_at, appointment.timezone)} was marked as missed.`,
            "If this is a mistake or you'd like to rebook, please reply on your request.",
          ],
    );
    revalidate(appointment.id);
    return { ok: true, message: status === "completed" ? "Marked as completed." : "Marked as no-show." };
  } catch (err) {
    return { ...failure(err), values };
  }
}

export async function resolveChangeRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = resolveChangeRequestSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  const { appointmentId, decision, message } = parsed.data;
  try {
    const user = await assertAdmin();
    const appointment = await loadAppointment(appointmentId, decision === "approve_cancellation" ? "approve_cancellation" : "dismiss_change");
    const time = when(appointment.starts_at, appointment.timezone);

    if (decision === "approve_cancellation") {
      await updateAppointment(appointment, {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: appointment.change_request_reason ?? "Cancelled at the client's request",
      });
      await audit(user.id, "appointment.cancellation_approved", "appointment", appointment.id);
      notifyClient(appointment, "appointment.changed", "Your cancellation is confirmed", "Appointment cancelled", [
        `As requested, the appointment on ${time} has been cancelled.`,
        ...(message ? [message] : []),
      ]);
    } else {
      const nextStatus = statusAfterDismiss(appointment.confirmed_at);
      await updateAppointment(appointment, { status: nextStatus, change_request_reason: null, change_requested_at: null });
      await audit(user.id, "appointment.change_request_dismissed", "appointment", appointment.id, {
        request: appointment.status,
      });
      notifyClient(appointment, "appointment.changed", "Update on your change request", "Your appointment stays as planned", [
        `Your ${appointment.status === "cancellation_requested" ? "cancellation" : "reschedule"} request was reviewed and the appointment on ${time} remains in place.`,
        ...(message ? [message] : []),
      ]);
    }
    revalidate(appointment.id);
    return { ok: true, message: decision === "approve_cancellation" ? "Cancellation approved." : "Change request dismissed." };
  } catch (err) {
    return { ...failure(err), values };
  }
}
