"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { failure, formValues, validationFailure, type ActionState } from "@/lib/action-result";
import { availabilityRuleSchema, blockedPeriodSchema } from "@/lib/validation/schemas";
import { availabilityRuleMetaSchema, bookingSettingsFormSchema, idSchema, optionalIdSchema } from "@/lib/validation/booking";
import { bookingSettingsSchema, getSettings } from "@/lib/settings";
import { localInputToUtc } from "@/lib/booking/rules";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/db/types";

function revalidate() {
  revalidatePath("/admin/availability");
  revalidatePath("/dashboard/appointments/book");
}

export async function saveAvailabilityRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const core = availabilityRuleSchema.safeParse(values);
  if (!core.success) return validationFailure(core.error, values);
  const meta = availabilityRuleMetaSchema.safeParse(values);
  if (!meta.success) return validationFailure(meta.error, values);
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const row = {
      weekday: core.data.weekday,
      start_time: core.data.startTime,
      end_time: core.data.endTime,
      is_active: meta.data.isActive,
    };
    const { data, error } = meta.data.id
      ? await supabase.from("availability_rules").update(row).eq("id", meta.data.id).select("id").single()
      : await supabase.from("availability_rules").insert(row).select("id").single();
    if (error || !data) throw error ?? new Error("Save failed");
    await audit(user.id, meta.data.id ? "availability_rule.updated" : "availability_rule.created", "availability_rule", data.id, row);
    revalidate();
    return { ok: true, message: meta.data.id ? "Hours updated." : "Hours added." };
  } catch (err) {
    return { ...failure(err), values };
  }
}

export async function deleteAvailabilityRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = idSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("availability_rules").delete().eq("id", parsed.data.id);
    if (error) throw error;
    await audit(user.id, "availability_rule.deleted", "availability_rule", parsed.data.id);
    revalidate();
    return { ok: true, message: "Hours removed." };
  } catch (err) {
    return failure(err);
  }
}

export async function saveBlockedPeriod(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = blockedPeriodSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  const idParsed = optionalIdSchema.safeParse(values);
  if (!idParsed.success) return validationFailure(idParsed.error, values);
  try {
    const user = await assertAdmin();
    const { timezone } = await getSettings("booking");
    // datetime-local values carry no offset: interpret them in the booking timezone.
    const startsAt = localInputToUtc(parsed.data.startsAt, timezone);
    const endsAt = localInputToUtc(parsed.data.endsAt, timezone);
    if (!startsAt) return { ok: false, message: "Please correct the highlighted fields.", fieldErrors: { startsAt: ["Enter a valid date and time"] }, values };
    if (!endsAt) return { ok: false, message: "Please correct the highlighted fields.", fieldErrors: { endsAt: ["Enter a valid date and time"] }, values };
    if (endsAt <= startsAt) return { ok: false, message: "Please correct the highlighted fields.", fieldErrors: { endsAt: ["End must be after start"] }, values };

    const supabase = await createClient();
    const row = { starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), reason: parsed.data.reason ?? null };
    const id = idParsed.data.id;
    const { data, error } = id
      ? await supabase.from("blocked_periods").update(row).eq("id", id).select("id").single()
      : await supabase.from("blocked_periods").insert({ ...row, created_by: user.id }).select("id").single();
    if (error || !data) throw error ?? new Error("Save failed");
    await audit(user.id, id ? "blocked_period.updated" : "blocked_period.created", "blocked_period", data.id, row);

    // Blocking time doesn't cancel existing bookings; tell the admin about overlaps.
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIVE_APPOINTMENT_STATUSES)
      .lt("starts_at", row.ends_at)
      .gt("ends_at", row.starts_at);
    revalidate();
    return {
      ok: true,
      message: count
        ? `Saved. Note: ${count} existing appointment${count === 1 ? "" : "s"} overlap this period — review them in Appointments.`
        : "Blocked period saved.",
    };
  } catch (err) {
    return { ...failure(err), values };
  }
}

export async function deleteBlockedPeriod(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = idSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("blocked_periods").delete().eq("id", parsed.data.id);
    if (error) throw error;
    await audit(user.id, "blocked_period.deleted", "blocked_period", parsed.data.id);
    revalidate();
    return { ok: true, message: "Blocked period removed." };
  } catch (err) {
    return failure(err);
  }
}

export async function saveBookingSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = bookingSettingsFormSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  const final = bookingSettingsSchema.safeParse(parsed.data);
  if (!final.success) return validationFailure(final.error, values);
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "booking", value: final.data, updated_by: user.id }, { onConflict: "key" });
    if (error) throw error;
    await audit(user.id, "settings.updated", "app_settings", "booking", final.data);
    revalidate();
    return { ok: true, message: "Booking settings saved." };
  } catch (err) {
    return { ...failure(err), values };
  }
}
