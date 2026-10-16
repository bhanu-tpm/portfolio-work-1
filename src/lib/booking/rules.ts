import { TZDate } from "@date-fns/tz";
import { ACTIVE_APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/db/types";

/**
 * Pure booking rules shared by pages, server actions and tests (no I/O, no AI).
 */

// ---------------------------------------------------------------------------
// Timezone conversion for <input type="datetime-local"> / <input type="date">
// ---------------------------------------------------------------------------

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Interprets a wall-clock value ("YYYY-MM-DDTHH:MM" or "YYYY-MM-DD") in the given
 * IANA timezone and returns the matching UTC instant. Returns null for invalid input
 * (including impossible dates such as 2030-02-31).
 */
export function localInputToUtc(value: string, timezone: string): Date | null {
  const m = LOCAL_INPUT.exec(value.trim());
  if (!m) return null;
  const [year, month, day, hour, minute, second] = [
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
    Number(m[6] ?? 0),
  ];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const date = new TZDate(year, month - 1, day, hour, minute, second, timezone);
  if (Number.isNaN(date.getTime()) || date.getDate() !== day || date.getMonth() !== month - 1) return null;
  return new Date(date.getTime());
}

/** Formats a UTC instant as a datetime-local value ("YYYY-MM-DDTHH:MM") in the given timezone. */
export function utcToLocalInput(iso: string | Date, timezone: string): string {
  const d = new TZDate(new Date(iso).getTime(), timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** UTC range covering whole local calendar days [from 00:00, to + 1 day 00:00) in the timezone. */
export function localDateRangeToUtc(
  from: string | undefined,
  to: string | undefined,
  timezone: string,
): { from: Date | null; to: Date | null } {
  const start = from ? localInputToUtc(from, timezone) : null;
  let end: Date | null = null;
  if (to) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
    if (m) {
      const next = new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1, 0, 0, 0, timezone);
      end = Number.isNaN(next.getTime()) ? null : new Date(next.getTime());
    }
  }
  return { from: start, to: end };
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Booking inputs
// ---------------------------------------------------------------------------

/** Category duration overrides the global slot length. */
export function bookingDuration(categoryDuration: number | null | undefined, slotMinutes: number): number {
  return categoryDuration && categoryDuration > 0 ? categoryDuration : slotMinutes;
}

/**
 * Formats a client can choose: the category's formats that are also enabled in the
 * booking settings. Order follows the booking settings.
 */
export function allowedFormats(categoryFormats: string[] | null | undefined, settingsFormats: string[]): string[] {
  if (!categoryFormats || categoryFormats.length === 0) return [...settingsFormats];
  return settingsFormats.filter((f) => categoryFormats.includes(f));
}

/** Parses a comma/newline separated list of formats (e.g. "video, phone"). */
export function parseFormatList(value: string): string[] {
  const items = value
    .split(/[,\n]/)
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);
  return [...new Set(items)];
}

// ---------------------------------------------------------------------------
// Database errors
// ---------------------------------------------------------------------------

export const SLOT_TAKEN_MESSAGE = "That slot was just taken — please pick another.";

/** Maps Postgres constraint violations from appointment writes to friendly messages. */
export function bookingErrorMessage(code: string | null | undefined): string | null {
  if (code === "23P01") return SLOT_TAKEN_MESSAGE; // exclusion constraint appointments_no_overlap
  if (code === "23505") return "This request already has an active appointment."; // one active per request
  return null;
}

// ---------------------------------------------------------------------------
// Status rules
// ---------------------------------------------------------------------------

export function isActiveStatus(status: AppointmentStatus) {
  return ACTIVE_APPOINTMENT_STATUSES.includes(status);
}

export type ChangeKind = "reschedule" | "cancel";

export const CHANGE_REQUEST_STATUS: Record<ChangeKind, AppointmentStatus> = {
  reschedule: "reschedule_requested",
  cancel: "cancellation_requested",
};

/** Statuses from which a client may ask for a change. */
export const CLIENT_CHANGEABLE_STATUSES: AppointmentStatus[] = ["pending", "confirmed"];

/** Whether a client may request a reschedule or cancellation of their appointment. */
export function canClientRequestChange(
  appointment: { status: AppointmentStatus; starts_at: string },
  now: Date = new Date(),
): { allowed: true } | { allowed: false; reason: string } {
  if (appointment.status === "reschedule_requested" || appointment.status === "cancellation_requested") {
    return { allowed: false, reason: "A change request is already waiting for review." };
  }
  if (!CLIENT_CHANGEABLE_STATUSES.includes(appointment.status)) {
    return { allowed: false, reason: "This appointment can no longer be changed." };
  }
  if (new Date(appointment.starts_at).getTime() <= now.getTime()) {
    return { allowed: false, reason: "This appointment has already started." };
  }
  return { allowed: true };
}

export type AdminAction =
  | "confirm"
  | "update_details"
  | "reschedule"
  | "cancel"
  | "complete"
  | "no_show"
  | "approve_cancellation"
  | "dismiss_change";

/** Actions the administrator can take for an appointment in a given status. */
export function adminActionsFor(status: AppointmentStatus): AdminAction[] {
  switch (status) {
    case "pending":
      return ["confirm", "reschedule", "cancel", "no_show"];
    case "confirmed":
      return ["update_details", "reschedule", "cancel", "complete", "no_show"];
    case "reschedule_requested":
      return ["reschedule", "dismiss_change", "cancel"];
    case "cancellation_requested":
      return ["approve_cancellation", "dismiss_change", "reschedule"];
    default:
      return [];
  }
}

/** Status an appointment returns to when a client change request is dismissed. */
export function statusAfterDismiss(confirmedAt: string | null): AppointmentStatus {
  return confirmedAt ? "confirmed" : "pending";
}

/**
 * Splits a client's appointments: upcoming = active and not yet ended (soonest first);
 * past = everything else (most recent first). Input is expected in ascending start order.
 */
export function splitAppointments<T extends { status: AppointmentStatus; ends_at: string }>(
  rows: T[],
  now: Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const row of rows) {
    if (isActiveStatus(row.status) && new Date(row.ends_at).getTime() >= now.getTime()) upcoming.push(row);
    else past.push(row);
  }
  return { upcoming, past: past.reverse() };
}

/** Pagination helper: inclusive row range for Supabase `.range()`. */
export function pageRange(page: number, pageSize: number): { from: number; to: number; page: number } {
  const p = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  return { from: (p - 1) * pageSize, to: p * pageSize - 1, page: p };
}
