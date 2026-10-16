import { describe, expect, it } from "vitest";
import {
  SLOT_TAKEN_MESSAGE,
  adminActionsFor,
  allowedFormats,
  bookingDuration,
  bookingErrorMessage,
  canClientRequestChange,
  isValidTimezone,
  localDateRangeToUtc,
  localInputToUtc,
  pageRange,
  parseFormatList,
  splitAppointments,
  statusAfterDismiss,
  utcToLocalInput,
} from "@/lib/booking/rules";
import { buildSlotGroups } from "@/lib/booking/display";

describe("localInputToUtc", () => {
  it("interprets datetime-local values in the booking timezone", () => {
    expect(localInputToUtc("2030-01-07T10:00", "Asia/Kolkata")?.toISOString()).toBe("2030-01-07T04:30:00.000Z");
    expect(localInputToUtc("2030-07-01T10:00", "Europe/London")?.toISOString()).toBe("2030-07-01T09:00:00.000Z");
    expect(localInputToUtc("2030-01-01T10:00", "Europe/London")?.toISOString()).toBe("2030-01-01T10:00:00.000Z");
  });

  it("accepts plain dates as local midnight", () => {
    expect(localInputToUtc("2030-01-07", "Asia/Kolkata")?.toISOString()).toBe("2030-01-06T18:30:00.000Z");
  });

  it("rejects malformed or impossible values", () => {
    expect(localInputToUtc("", "Asia/Kolkata")).toBeNull();
    expect(localInputToUtc("07/01/2030 10:00", "Asia/Kolkata")).toBeNull();
    expect(localInputToUtc("2030-02-31T10:00", "Asia/Kolkata")).toBeNull();
    expect(localInputToUtc("2030-01-07T25:00", "Asia/Kolkata")).toBeNull();
  });

  it("round-trips with utcToLocalInput", () => {
    const iso = "2030-03-31T09:15:00.000Z";
    expect(utcToLocalInput(iso, "Europe/London")).toBe("2030-03-31T10:15");
    expect(localInputToUtc(utcToLocalInput(iso, "Europe/London"), "Europe/London")?.toISOString()).toBe(iso);
    expect(utcToLocalInput("2030-01-07T04:30:00Z", "Asia/Kolkata")).toBe("2030-01-07T10:00");
  });
});

describe("localDateRangeToUtc", () => {
  it("covers whole local days", () => {
    const r = localDateRangeToUtc("2030-01-07", "2030-01-07", "Asia/Kolkata");
    expect(r.from?.toISOString()).toBe("2030-01-06T18:30:00.000Z");
    expect(r.to?.toISOString()).toBe("2030-01-07T18:30:00.000Z");
  });

  it("handles open ranges and month ends", () => {
    expect(localDateRangeToUtc(undefined, undefined, "Asia/Kolkata")).toEqual({ from: null, to: null });
    expect(localDateRangeToUtc(undefined, "2030-01-31", "UTC").to?.toISOString()).toBe("2030-02-01T00:00:00.000Z");
  });
});

describe("booking inputs", () => {
  it("lets the category duration override the slot length", () => {
    expect(bookingDuration(90, 60)).toBe(90);
    expect(bookingDuration(null, 60)).toBe(60);
    expect(bookingDuration(undefined, 45)).toBe(45);
  });

  it("intersects category formats with the booking settings", () => {
    expect(allowedFormats(["phone", "in_person", "video"], ["video", "phone"])).toEqual(["video", "phone"]);
    expect(allowedFormats(["in_person"], ["video", "phone"])).toEqual([]);
    expect(allowedFormats([], ["video"])).toEqual(["video"]);
  });

  it("parses format lists", () => {
    expect(parseFormatList("Video, phone,\nIn Person, video")).toEqual(["video", "phone", "in_person"]);
    expect(parseFormatList(" , ")).toEqual([]);
  });

  it("validates timezones", () => {
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
  });
});

describe("bookingErrorMessage", () => {
  it("maps constraint violations to friendly messages", () => {
    expect(bookingErrorMessage("23P01")).toBe(SLOT_TAKEN_MESSAGE);
    expect(bookingErrorMessage("23505")).toMatch(/already has an active appointment/);
    expect(bookingErrorMessage("42501")).toBeNull();
    expect(bookingErrorMessage(undefined)).toBeNull();
  });
});

describe("change request rules", () => {
  const now = new Date("2030-01-07T00:00:00Z");
  const future = "2030-01-08T04:30:00Z";

  it("allows pending and confirmed future appointments", () => {
    expect(canClientRequestChange({ status: "pending", starts_at: future }, now).allowed).toBe(true);
    expect(canClientRequestChange({ status: "confirmed", starts_at: future }, now).allowed).toBe(true);
  });

  it("rejects duplicates, terminal statuses and past appointments", () => {
    expect(canClientRequestChange({ status: "reschedule_requested", starts_at: future }, now)).toEqual({
      allowed: false,
      reason: "A change request is already waiting for review.",
    });
    expect(canClientRequestChange({ status: "cancelled", starts_at: future }, now).allowed).toBe(false);
    expect(canClientRequestChange({ status: "completed", starts_at: future }, now).allowed).toBe(false);
    expect(canClientRequestChange({ status: "confirmed", starts_at: "2030-01-06T23:00:00Z" }, now).allowed).toBe(false);
  });

  it("returns the right admin actions per status", () => {
    expect(adminActionsFor("pending")).toContain("confirm");
    expect(adminActionsFor("confirmed")).toEqual(expect.arrayContaining(["complete", "no_show", "reschedule", "cancel"]));
    expect(adminActionsFor("cancellation_requested")).toEqual(expect.arrayContaining(["approve_cancellation", "dismiss_change"]));
    expect(adminActionsFor("reschedule_requested")).toContain("reschedule");
    expect(adminActionsFor("cancelled")).toEqual([]);
    expect(adminActionsFor("completed")).toEqual([]);
  });

  it("restores the previous status when a change request is dismissed", () => {
    expect(statusAfterDismiss("2030-01-01T00:00:00Z")).toBe("confirmed");
    expect(statusAfterDismiss(null)).toBe("pending");
  });
});

describe("splitAppointments", () => {
  it("separates upcoming active appointments from past or terminal ones", () => {
    const now = new Date("2030-01-07T00:00:00Z");
    const rows = [
      { id: "a", status: "confirmed" as const, ends_at: "2030-01-06T10:00:00Z" },
      { id: "b", status: "cancelled" as const, ends_at: "2030-01-08T10:00:00Z" },
      { id: "c", status: "pending" as const, ends_at: "2030-01-08T11:00:00Z" },
      { id: "d", status: "reschedule_requested" as const, ends_at: "2030-01-09T11:00:00Z" },
    ];
    const { upcoming, past } = splitAppointments(rows, now);
    expect(upcoming.map((r) => r.id)).toEqual(["c", "d"]);
    expect(past.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("pageRange", () => {
  it("computes inclusive ranges and clamps invalid pages", () => {
    expect(pageRange(1, 20)).toEqual({ from: 0, to: 19, page: 1 });
    expect(pageRange(3, 20)).toEqual({ from: 40, to: 59, page: 3 });
    expect(pageRange(0, 20).page).toBe(1);
    expect(pageRange(Number.NaN, 20).page).toBe(1);
  });
});

describe("buildSlotGroups", () => {
  it("groups slots by local day with labels in the consultant timezone", () => {
    const groups = buildSlotGroups(
      [
        { startsAt: "2030-01-07T04:30:00.000Z", endsAt: "2030-01-07T05:30:00.000Z" },
        { startsAt: "2030-01-07T19:00:00.000Z", endsAt: "2030-01-07T20:00:00.000Z" }, // 00:30 IST on the 8th
      ],
      "Asia/Kolkata",
    );
    expect(groups.map((g) => g.key)).toEqual(["2030-01-07", "2030-01-08"]);
    expect(groups[0].slots[0].label).toMatch(/10:00/);
  });
});
