import { groupSlotsByDay, type Slot } from "./slots";

export interface SlotDayGroup {
  key: string; // YYYY-MM-DD in the consultant timezone
  label: string; // e.g. "Mon, 7 Jan"
  slots: { startsAt: string; label: string }[];
}

/**
 * Pre-formats slots on the server (in the consultant timezone) so the client
 * picker renders identical labels regardless of the browser's timezone.
 */
export function buildSlotGroups(slots: Slot[], timezone: string): SlotDayGroup[] {
  const dayFormat = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: timezone });
  const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: timezone });
  return [...groupSlotsByDay(slots, timezone).entries()].map(([key, daySlots]) => ({
    key,
    label: dayFormat.format(new Date(daySlots[0].startsAt)),
    slots: daySlots.map((s) => ({ startsAt: s.startsAt, label: timeFormat.format(new Date(s.startsAt)) })),
  }));
}
