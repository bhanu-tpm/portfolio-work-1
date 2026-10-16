import { TZDate } from "@date-fns/tz";

/**
 * Deterministic availability engine. Pure functions only: no AI, no I/O.
 *
 * A slot [start, start + duration) is bookable when
 *  - it lies inside an active weekly availability rule (in the consultant's timezone),
 *  - start >= now + minimum notice and start <= now + max days ahead,
 *  - it does not overlap a blocked period,
 *  - [start, start + duration + buffer) does not overlap an existing active booking
 *    (whose stored range already includes its own trailing buffer).
 */

export interface SlotRule {
  weekday: number; // 0 = Sunday
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  is_active?: boolean;
}

export interface Range {
  start: Date;
  end: Date;
}

export interface SlotOptions {
  timezone: string;
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  rules: SlotRule[];
  blocked: Range[];
  busy: Range[];
  now: Date;
}

export interface Slot {
  startsAt: string; // ISO (UTC)
  endsAt: string;
}

const MINUTE = 60_000;

function parseTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  return { h, m };
}

function overlaps(aStart: number, aEnd: number, b: Range) {
  return aStart < b.end.getTime() && b.start.getTime() < aEnd;
}

export function generateSlots(opts: SlotOptions): Slot[] {
  const { timezone, durationMinutes, bufferMinutes, now } = opts;
  if (durationMinutes <= 0) return [];

  const earliest = now.getTime() + opts.minNoticeHours * 60 * MINUTE;
  const latest = now.getTime() + opts.maxDaysAhead * 24 * 60 * MINUTE;
  const step = (durationMinutes + bufferMinutes) * MINUTE;
  const duration = durationMinutes * MINUTE;
  const activeRules = opts.rules.filter((r) => r.is_active !== false);

  const today = new TZDate(now.getTime(), timezone);
  const slots: Slot[] = [];
  const seen = new Set<number>();

  for (let day = 0; day <= opts.maxDaysAhead; day++) {
    // Constructing with an overflowing day number normalises to the right calendar date.
    const date = new TZDate(today.getFullYear(), today.getMonth(), today.getDate() + day, 0, 0, 0, timezone);
    const weekday = date.getDay();

    for (const rule of activeRules.filter((r) => r.weekday === weekday)) {
      const s = parseTime(rule.start_time);
      const e = parseTime(rule.end_time);
      const windowStart = new TZDate(date.getFullYear(), date.getMonth(), date.getDate(), s.h, s.m, 0, timezone).getTime();
      const windowEnd = new TZDate(date.getFullYear(), date.getMonth(), date.getDate(), e.h, e.m, 0, timezone).getTime();

      for (let start = windowStart; start + duration <= windowEnd; start += step) {
        if (start < earliest || start > latest || seen.has(start)) continue;
        const end = start + duration;
        if (opts.blocked.some((b) => overlaps(start, end, b))) continue;
        if (opts.busy.some((b) => overlaps(start, end + bufferMinutes * MINUTE, b))) continue;
        seen.add(start);
        slots.push({ startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() });
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Server-side re-validation of a requested start time against current availability. */
export function findSlot(opts: SlotOptions, startsAtIso: string): Slot | null {
  const target = new Date(startsAtIso).getTime();
  if (Number.isNaN(target)) return null;
  return generateSlots(opts).find((s) => new Date(s.startsAt).getTime() === target) ?? null;
}

/** Groups slots by local calendar date (YYYY-MM-DD in the consultant timezone). */
export function groupSlotsByDay(slots: Slot[], timezone: string) {
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    const d = new TZDate(new Date(slot.startsAt).getTime(), timezone);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  return groups;
}
