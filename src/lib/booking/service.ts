import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { getSettings, type BookingSettings } from "@/lib/settings";
import { ACTIVE_APPOINTMENT_STATUSES, type AvailabilityRule } from "@/lib/db/types";
import { findSlot, generateSlots, type Slot, type SlotOptions } from "./slots";

/**
 * Server-side loader for the deterministic slot engine. Reads availability with the
 * service role (availability tables have no client policies), so callers must have
 * authorized the user before exposing results.
 */

export interface SlotQuery {
  durationMinutes: number;
  /** Ignore this appointment's own busy range (used when rescheduling it). */
  excludeAppointmentId?: string;
  /** Admin overrides, e.g. allow rescheduling inside the minimum-notice window. */
  minNoticeHours?: number;
  now?: Date;
}

export interface SlotContext {
  options: SlotOptions;
  settings: BookingSettings;
}

export async function loadSlotContext(query: SlotQuery): Promise<SlotContext> {
  const settings = await getSettings("booking");
  const now = query.now ?? new Date();
  // One extra day covers slots on the last calendar day of the horizon.
  const horizonEnd = new Date(now.getTime() + (settings.maxDaysAhead + 1) * 86_400_000);
  const admin = createAdminClient();

  let busyQuery = admin
    .from("appointments")
    .select("id, blocked_from, blocked_until")
    .in("status", ACTIVE_APPOINTMENT_STATUSES)
    .gt("blocked_until", now.toISOString())
    .lt("blocked_from", horizonEnd.toISOString());
  if (query.excludeAppointmentId) busyQuery = busyQuery.neq("id", query.excludeAppointmentId);

  const [rulesResult, blockedResult, busyResult] = await Promise.all([
    admin.from("availability_rules").select("weekday, start_time, end_time, is_active").eq("is_active", true),
    admin
      .from("blocked_periods")
      .select("starts_at, ends_at")
      .gt("ends_at", now.toISOString())
      .lt("starts_at", horizonEnd.toISOString()),
    busyQuery,
  ]);
  const failed = rulesResult.error ?? blockedResult.error ?? busyResult.error;
  if (failed) throw new Error(`Could not load availability: ${failed.message}`);

  const options: SlotOptions = {
    timezone: settings.timezone,
    durationMinutes: query.durationMinutes,
    bufferMinutes: settings.bufferMinutes,
    minNoticeHours: query.minNoticeHours ?? settings.minNoticeHours,
    maxDaysAhead: settings.maxDaysAhead,
    rules: (rulesResult.data ?? []) as Pick<AvailabilityRule, "weekday" | "start_time" | "end_time" | "is_active">[],
    blocked: (blockedResult.data ?? []).map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
    busy: (busyResult.data ?? []).map((b) => ({ start: new Date(b.blocked_from), end: new Date(b.blocked_until) })),
    now,
  };
  return { options, settings };
}

export async function getAvailableSlots(query: SlotQuery): Promise<{ slots: Slot[]; settings: BookingSettings }> {
  const { options, settings } = await loadSlotContext(query);
  return { slots: generateSlots(options), settings };
}

/** Re-validates a requested start time against fresh availability. Returns null if no longer bookable. */
export async function validateSlot(
  query: SlotQuery & { startsAt: string },
): Promise<{ slot: Slot | null; settings: BookingSettings }> {
  const { options, settings } = await loadSlotContext(query);
  return { slot: findSlot(options, query.startsAt), settings };
}
