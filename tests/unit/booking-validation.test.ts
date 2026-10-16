import { describe, expect, it } from "vitest";
import {
  appointmentFiltersSchema,
  availabilityRuleMetaSchema,
  bookingSettingsFormSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
} from "@/lib/validation/booking";

const ID = "4b0f3a1e-2c4d-4e5f-8a9b-0c1d2e3f4a5b";

describe("bookingSettingsFormSchema", () => {
  const base = {
    timezone: "Asia/Kolkata",
    slotMinutes: "60",
    bufferMinutes: "15",
    minNoticeHours: "24",
    maxDaysAhead: "30",
    formats: "video, phone",
    reminderHoursBefore: "24",
  };

  it("parses form strings", () => {
    const parsed = bookingSettingsFormSchema.parse(base);
    expect(parsed).toMatchObject({ slotMinutes: 60, bufferMinutes: 15, formats: ["video", "phone"] });
  });

  it("rejects unknown timezones and empty formats", () => {
    const r = bookingSettingsFormSchema.safeParse({ ...base, timezone: "Nowhere/City", formats: " " });
    expect(r.success).toBe(false);
    const fields = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["timezone", "formats"]));
  });

  it("enforces ranges", () => {
    expect(bookingSettingsFormSchema.safeParse({ ...base, slotMinutes: "5" }).success).toBe(false);
    expect(bookingSettingsFormSchema.safeParse({ ...base, reminderHoursBefore: "100" }).success).toBe(false);
  });
});

describe("admin appointment schemas", () => {
  it("requires a cancellation reason", () => {
    expect(cancelAppointmentSchema.safeParse({ appointmentId: ID, reason: " " }).success).toBe(false);
    expect(cancelAppointmentSchema.safeParse({ appointmentId: ID, reason: "Consultant unavailable" }).success).toBe(true);
  });

  it("requires an ISO start with offset for rescheduling", () => {
    expect(rescheduleAppointmentSchema.safeParse({ appointmentId: ID, startsAt: "" }).success).toBe(false);
    expect(rescheduleAppointmentSchema.safeParse({ appointmentId: ID, startsAt: "2030-01-07T04:30:00.000Z" }).success).toBe(true);
  });

  it("parses rule metadata", () => {
    expect(availabilityRuleMetaSchema.parse({ id: "", isActive: "on" })).toEqual({ id: undefined, isActive: true });
    expect(availabilityRuleMetaSchema.parse({ id: ID })).toEqual({ id: ID, isActive: false });
  });
});

describe("appointmentFiltersSchema", () => {
  it("falls back to defaults for invalid search params", () => {
    expect(appointmentFiltersSchema.parse({ view: "bogus", status: "nope", from: "x", page: "-3" })).toEqual({
      view: "upcoming",
      status: "all",
      from: undefined,
      to: undefined,
      page: 1,
    });
  });

  it("keeps valid filters", () => {
    expect(appointmentFiltersSchema.parse({ view: "past", status: "confirmed", from: "2030-01-01", to: "2030-01-31", page: "2" })).toEqual({
      view: "past",
      status: "confirmed",
      from: "2030-01-01",
      to: "2030-01-31",
      page: 2,
    });
  });
});
