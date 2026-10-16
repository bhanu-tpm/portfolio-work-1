import { describe, expect, it } from "vitest";
import { findSlot, generateSlots, groupSlotsByDay, type SlotOptions } from "@/lib/booking/slots";

// Monday 2030-01-07 00:00 IST = 2030-01-06T18:30:00Z
const MONDAY_MIDNIGHT_IST = new Date("2030-01-06T18:30:00Z");

function options(overrides: Partial<SlotOptions> = {}): SlotOptions {
  return {
    timezone: "Asia/Kolkata",
    durationMinutes: 60,
    bufferMinutes: 15,
    minNoticeHours: 0,
    maxDaysAhead: 1,
    rules: [{ weekday: 1, start_time: "10:00", end_time: "13:00" }],
    blocked: [],
    busy: [],
    now: MONDAY_MIDNIGHT_IST,
    ...overrides,
  };
}

describe("generateSlots", () => {
  it("creates slots inside the weekly window in the consultant timezone", () => {
    const slots = generateSlots(options());
    // 10:00, 11:15 fit; 12:30 would end at 13:30 which exceeds the window.
    expect(slots.map((s) => s.startsAt)).toEqual(["2030-01-07T04:30:00.000Z", "2030-01-07T05:45:00.000Z"]);
    expect(slots[0].endsAt).toBe("2030-01-07T05:30:00.000Z");
  });

  it("respects minimum notice", () => {
    const slots = generateSlots(options({ now: new Date("2030-01-07T04:00:00Z"), minNoticeHours: 1 }));
    expect(slots.map((s) => s.startsAt)).toEqual(["2030-01-07T05:45:00.000Z"]);
  });

  it("respects the maximum booking horizon", () => {
    const slots = generateSlots(
      options({ maxDaysAhead: 14, rules: [{ weekday: 1, start_time: "10:00", end_time: "11:00" }] }),
    );
    // Mondays on the 7th, 14th and 21st... but the 21st 10:00 IST is beyond 14 days from now.
    expect(slots.map((s) => s.startsAt)).toEqual(["2030-01-07T04:30:00.000Z", "2030-01-14T04:30:00.000Z"]);
  });

  it("excludes blocked periods", () => {
    const slots = generateSlots(
      options({ blocked: [{ start: new Date("2030-01-07T04:00:00Z"), end: new Date("2030-01-07T05:00:00Z") }] }),
    );
    expect(slots.map((s) => s.startsAt)).toEqual(["2030-01-07T05:45:00.000Z"]);
  });

  it("keeps a buffer before existing bookings", () => {
    // Existing booking 11:15–12:15 IST (05:45–06:45Z), blocked until 06:45+15m.
    const busy = [{ start: new Date("2030-01-07T05:45:00Z"), end: new Date("2030-01-07T07:00:00Z") }];
    const slots = generateSlots(
      options({ busy, rules: [{ weekday: 1, start_time: "10:15", end_time: "13:00" }] }),
    );
    // 10:15–11:15 would leave no buffer before the 11:15 booking, so it is excluded.
    expect(slots.map((s) => s.startsAt)).toEqual([]);
  });

  it("ignores inactive rules", () => {
    const slots = generateSlots(
      options({ rules: [{ weekday: 1, start_time: "10:00", end_time: "13:00", is_active: false }] }),
    );
    expect(slots).toHaveLength(0);
  });

  it("handles daylight saving transitions in other timezones", () => {
    // London switches to BST on Sunday 2030-03-31. Monday 10:00 BST = 09:00Z.
    const slots = generateSlots(
      options({
        timezone: "Europe/London",
        now: new Date("2030-03-29T00:00:00Z"),
        maxDaysAhead: 4,
        rules: [{ weekday: 1, start_time: "10:00", end_time: "11:00" }],
      }),
    );
    expect(slots.map((s) => s.startsAt)).toEqual(["2030-04-01T09:00:00.000Z"]);
  });
});

describe("findSlot", () => {
  it("accepts only exact currently-available slots", () => {
    expect(findSlot(options(), "2030-01-07T10:00:00+05:30")).not.toBeNull();
    expect(findSlot(options(), "2030-01-07T10:30:00+05:30")).toBeNull();
    expect(findSlot(options(), "not-a-date")).toBeNull();
  });
});

describe("groupSlotsByDay", () => {
  it("groups by local date", () => {
    const rules = [
      { weekday: 1, start_time: "10:00", end_time: "13:00" },
      { weekday: 2, start_time: "10:00", end_time: "11:00" },
    ];
    const groups = groupSlotsByDay(generateSlots(options({ maxDaysAhead: 3, rules })), "Asia/Kolkata");
    expect([...groups.keys()]).toEqual(["2030-01-07", "2030-01-08"]);
    expect(groups.get("2030-01-07")).toHaveLength(2);
    expect(groups.get("2030-01-08")).toHaveLength(1);
  });
});
