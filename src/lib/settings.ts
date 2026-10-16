import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/lib/env";

export const bookingSettingsSchema = z.object({
  timezone: z.string().min(1).default("Asia/Kolkata"),
  slotMinutes: z.coerce.number().int().min(15).max(240).default(60),
  bufferMinutes: z.coerce.number().int().min(0).max(120).default(15),
  minNoticeHours: z.coerce.number().int().min(0).max(24 * 14).default(24),
  maxDaysAhead: z.coerce.number().int().min(1).max(180).default(30),
  formats: z.array(z.string().min(1).max(40)).min(1).default(["video", "phone"]),
  reminderHoursBefore: z.coerce.number().int().min(1).max(72).default(24),
});
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

export const aiSettingsSchema = z.object({
  intakeAnalysis: z.boolean().default(true),
  outcomeDraft: z.boolean().default(true),
  resourceSuggestions: z.boolean().default(true),
  careerAssistant: z.boolean().default(true),
  resumeReview: z.boolean().default(true),
  model: z.string().min(1).max(80).nullable().default(null),
  assistantDailyMessageLimit: z.coerce.number().int().min(0).max(500).default(30),
  resumeDailyLimit: z.coerce.number().int().min(0).max(50).default(3),
  adminDailyLimit: z.coerce.number().int().min(0).max(5000).default(200),
  monthlyBudgetUsd: z.coerce.number().min(0).max(10_000).default(20),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const emailSettingsSchema = z.object({
  newRequest: z.boolean().default(true),
  statusChange: z.boolean().default(true),
  moreInfo: z.boolean().default(true),
  appointment: z.boolean().default(true),
  reminders: z.boolean().default(true),
  outcomePublished: z.boolean().default(true),
  contact: z.boolean().default(true),
});
export type EmailSettings = z.infer<typeof emailSettingsSchema>;

export const privacySettingsSchema = z.object({
  assistantRetentionDays: z.coerce.number().int().min(1).max(3650).default(180),
  aiRunRetentionDays: z.coerce.number().int().min(1).max(3650).default(365),
  resumeRetentionDays: z.coerce.number().int().min(1).max(3650).default(90),
});
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;

const schemas = {
  booking: bookingSettingsSchema,
  ai: aiSettingsSchema,
  email: emailSettingsSchema,
  privacy: privacySettingsSchema,
} as const;
export type SettingsKey = keyof typeof schemas;
type SettingsValue<K extends SettingsKey> = z.infer<(typeof schemas)[K]>;

/**
 * Reads settings with the service role (settings are admin-only under RLS but
 * some values, like booking rules, drive public behaviour). Falls back to the
 * schema defaults when the row is missing or invalid.
 */
export async function getSettings<K extends SettingsKey>(key: K): Promise<SettingsValue<K>> {
  const schema = schemas[key];
  if (!isServiceRoleConfigured()) return schema.parse({}) as SettingsValue<K>;
  const { data } = await createAdminClient().from("app_settings").select("value").eq("key", key).maybeSingle();
  const parsed = schema.safeParse(data?.value ?? {});
  return (parsed.success ? parsed.data : schema.parse({})) as SettingsValue<K>;
}

export function parseSettings<K extends SettingsKey>(key: K, value: unknown): SettingsValue<K> {
  return schemas[key].parse(value) as SettingsValue<K>;
}
