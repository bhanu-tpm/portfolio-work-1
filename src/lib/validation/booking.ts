import { z } from "zod";
import { checkbox, optionalText, requiredText, uuid } from "./common";
import { isValidTimezone, parseFormatList } from "@/lib/booking/rules";

// Booking/scheduling schemas that complement src/lib/validation/schemas.ts
// (availabilityRuleSchema, blockedPeriodSchema, bookAppointmentSchema, appointmentChangeRequestSchema).

/** Extra fields for creating/updating an availability rule (core fields use availabilityRuleSchema). */
export const availabilityRuleMetaSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  isActive: checkbox,
});

export const optionalIdSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
});

export const idSchema = z.object({ id: uuid });

/**
 * Form shape of the booking settings. The result is then validated with
 * bookingSettingsSchema (src/lib/settings.ts) before saving.
 */
export const bookingSettingsFormSchema = z.object({
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required")
    .refine(isValidTimezone, "Use an IANA timezone such as Asia/Kolkata"),
  slotMinutes: z.coerce.number().int().min(15, "At least 15 minutes").max(240, "At most 240 minutes"),
  bufferMinutes: z.coerce.number().int().min(0).max(120, "At most 120 minutes"),
  minNoticeHours: z.coerce.number().int().min(0).max(24 * 14, "At most 336 hours"),
  maxDaysAhead: z.coerce.number().int().min(1).max(180, "At most 180 days"),
  formats: z.preprocess(
    (v) => (typeof v === "string" ? parseFormatList(v) : v),
    z
      .array(z.string().min(1).max(40).regex(/^[a-z0-9_]+$/, "Use letters, numbers and underscores"))
      .min(1, "Enter at least one format")
      .max(10),
  ),
  reminderHoursBefore: z.coerce.number().int().min(1).max(72, "At most 72 hours"),
});

export const meetingDetailsField = optionalText(1000);

export const confirmAppointmentSchema = z.object({
  appointmentId: uuid,
  meetingDetails: meetingDetailsField,
});

export const rescheduleAppointmentSchema = z.object({
  appointmentId: uuid,
  startsAt: z.iso.datetime({ offset: true, error: "Choose a time slot" }),
  meetingDetails: meetingDetailsField,
  message: optionalText(1000),
});

export const cancelAppointmentSchema = z.object({
  appointmentId: uuid,
  reason: requiredText(3, 1000, "Reason"),
});

export const appointmentOutcomeSchema = z.object({
  appointmentId: uuid,
  status: z.enum(["completed", "no_show"]),
});

export const resolveChangeRequestSchema = z.object({
  appointmentId: uuid,
  decision: z.enum(["approve_cancellation", "dismiss"]),
  message: optionalText(1000),
});

const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v : undefined),
  z.iso.date().optional().catch(undefined),
);

/** Admin appointment list filters from searchParams (invalid values fall back to defaults). */
export const appointmentFiltersSchema = z.object({
  view: z.enum(["upcoming", "past"]).catch("upcoming"),
  status: z
    .enum(["all", "pending", "confirmed", "reschedule_requested", "cancellation_requested", "cancelled", "completed", "no_show"])
    .catch("all"),
  from: optionalDate,
  to: optionalDate,
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type AppointmentFilters = z.infer<typeof appointmentFiltersSchema>;
