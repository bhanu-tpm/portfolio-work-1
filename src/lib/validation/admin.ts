/**
 * Query-parameter and form parsing for the admin area (settings, clients,
 * AI usage, audit log, notifications). Pure functions only: every value coming
 * from the URL is validated against an allow-list before it reaches PostgREST.
 */
import type { AiFeature, AiRun, Notification } from "@/lib/db/types";
import { firstParam, parsePage, type RawSearchParams, type SearchParamValue } from "@/lib/pagination";

// ---------------------------------------------------------------------------
// Generic parsers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Returns the value only when it is one of `allowed`. */
export function parseEnumParam<T extends string>(value: SearchParamValue, allowed: readonly T[]): T | undefined {
  const raw = firstParam(value)?.trim();
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

/**
 * Free-text search term: Unicode letters/digits, spaces and the few symbols
 * that appear in names and email addresses. Everything else (commas,
 * parentheses, quotes, backslashes, wildcards) is removed, so the term can't
 * change the shape of a PostgREST filter.
 */
export function sanitizeSearchTerm(value: SearchParamValue, maxLength = 80): string | undefined {
  const raw = firstParam(value);
  if (!raw) return undefined;
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s@.+'_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
  return cleaned.length >= 1 ? cleaned : undefined;
}

/** Escapes LIKE metacharacters so user input matches literally. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Quotes a value for a PostgREST logic tree (`.or()`): escapes backslashes and double quotes. */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * `col1.ilike."%term%",col2.ilike."%term%"` for `.or()`. Columns must be
 * trusted identifiers; the term is sanitised, LIKE-escaped and quoted.
 */
export function buildIlikeOrFilter(columns: readonly string[], term: string): string {
  for (const col of columns) {
    if (!/^[a-z_][a-z0-9_]*$/.test(col)) throw new Error(`Invalid column name: ${col}`);
  }
  const pattern = quotePostgrestValue(`%${escapeLike(term)}%`);
  return columns.map((col) => `${col}.ilike.${pattern}`).join(",");
}

/** `YYYY-MM-DD` that is a real calendar date, else undefined. */
export function parseDateParam(value: SearchParamValue): string | undefined {
  const raw = firstParam(value)?.trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const [y, m, d] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  if (y < 2000 || y > 2100) return undefined;
  return raw;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Converts an inclusive local date range into timestamptz bounds
 * (`created_at >= gte` and `created_at < lt`). Default offset is IST.
 */
export function dateRangeBounds(
  from: string | undefined,
  to: string | undefined,
  utcOffset = "+05:30",
): { gte?: string; lt?: string } {
  const bounds: { gte?: string; lt?: string } = {};
  if (from) bounds.gte = `${from}T00:00:00${utcOffset}`;
  if (to) bounds.lt = `${addDays(to, 1)}T00:00:00${utcOffset}`;
  return bounds;
}

// ---------------------------------------------------------------------------
// Page-specific filters
// ---------------------------------------------------------------------------

export const AI_FEATURES = [
  "intake_analysis",
  "outcome_draft",
  "resource_suggestions",
  "career_assistant",
  "resume_review",
] as const satisfies readonly AiFeature[];

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  intake_analysis: "Intake analysis",
  outcome_draft: "Outcome drafts",
  resource_suggestions: "Resource suggestions",
  career_assistant: "Career assistant",
  resume_review: "Resume review",
};

export const AI_RUN_STATUSES = ["pending", "succeeded", "failed"] as const satisfies readonly AiRun["status"][];

export const NOTIFICATION_STATUSES = ["queued", "sent", "failed", "skipped"] as const satisfies readonly Notification["status"][];
export const NOTIFICATION_CHANNELS = ["email", "in_app"] as const satisfies readonly Notification["channel"][];

export interface ClientListFilters {
  q?: string;
  page: number;
}

export function parseClientFilters(sp: RawSearchParams): ClientListFilters {
  return { q: sanitizeSearchTerm(sp.q), page: parsePage(sp.page) };
}

export interface AiRunFilters {
  feature?: AiFeature;
  status?: AiRun["status"];
  page: number;
}

export function parseAiRunFilters(sp: RawSearchParams): AiRunFilters {
  return {
    feature: parseEnumParam(sp.feature, AI_FEATURES),
    status: parseEnumParam(sp.status, AI_RUN_STATUSES),
    page: parsePage(sp.page),
  };
}

export interface AuditFilters {
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page: number;
}

/** Action prefix like `settings.` or `outcome.publish`: lowercase identifiers and dots only. */
export function parseActionPrefix(value: SearchParamValue): string | undefined {
  const raw = firstParam(value)?.trim().toLowerCase();
  return raw && /^[a-z0-9_.-]{1,60}$/.test(raw) ? raw : undefined;
}

export function parseEntityType(value: SearchParamValue): string | undefined {
  const raw = firstParam(value)?.trim().toLowerCase();
  return raw && /^[a-z0-9_]{1,40}$/.test(raw) ? raw : undefined;
}

export function parseAuditFilters(sp: RawSearchParams): AuditFilters {
  let from = parseDateParam(sp.from);
  let to = parseDateParam(sp.to);
  // A reversed range is almost certainly a typo: swap rather than show nothing.
  if (from && to && from > to) [from, to] = [to, from];
  return {
    action: parseActionPrefix(sp.action),
    entity: parseEntityType(sp.entity),
    from,
    to,
    page: parsePage(sp.page),
  };
}

export interface NotificationFilters {
  status?: Notification["status"];
  channel?: Notification["channel"];
  page: number;
}

export function parseNotificationFilters(sp: RawSearchParams): NotificationFilters {
  return {
    status: parseEnumParam(sp.status, NOTIFICATION_STATUSES),
    channel: parseEnumParam(sp.channel, NOTIFICATION_CHANNELS),
    page: parsePage(sp.page),
  };
}

// ---------------------------------------------------------------------------
// Settings forms → plain objects (validated afterwards with the settings schemas)
// ---------------------------------------------------------------------------

export const EMAIL_SETTING_FIELDS = [
  { key: "newRequest", label: "New consultation request", description: "Email me when a client submits a request." },
  { key: "statusChange", label: "Request status changes and messages", description: "Email clients when their request status changes or I reply." },
  { key: "moreInfo", label: "More information required", description: "Email clients when I ask for clarification." },
  { key: "appointment", label: "Appointment bookings and changes", description: "Booking confirmations, reschedules and cancellations." },
  { key: "reminders", label: "Appointment reminders", description: "Reminder emails sent by the scheduled cron job." },
  { key: "outcomePublished", label: "Outcome published", description: "Email clients when their consultation outcome is available." },
  { key: "contact", label: "Contact form messages", description: "Email me when someone uses the public contact form." },
] as const;
export type EmailSettingKey = (typeof EMAIL_SETTING_FIELDS)[number]["key"];

export const AI_TOGGLE_FIELDS = [
  { key: "intakeAnalysis", label: "Intake analysis", description: "Summarises new requests for my review (only with the client's AI consent)." },
  { key: "outcomeDraft", label: "Outcome drafts", description: "Drafts outcome documents that I edit, approve and publish." },
  { key: "resourceSuggestions", label: "Resource suggestions", description: "Suggests learning resources while I write outcomes." },
  { key: "careerAssistant", label: "Career assistant", description: "Client-facing career guidance chat." },
  { key: "resumeReview", label: "Resume review", description: "Client-facing automated resume feedback." },
] as const;
export type AiToggleKey = (typeof AI_TOGGLE_FIELDS)[number]["key"];

export const AI_NUMBER_FIELDS = [
  { key: "assistantDailyMessageLimit", label: "Career assistant messages per client per day", min: 0, max: 500, step: "1" },
  { key: "resumeDailyLimit", label: "Resume reviews per client per day", min: 0, max: 50, step: "1" },
  { key: "adminDailyLimit", label: "Admin AI calls per day", min: 0, max: 5000, step: "1" },
  { key: "monthlyBudgetUsd", label: "Monthly budget (USD)", min: 0, max: 10_000, step: "0.01" },
] as const;

export const PRIVACY_NUMBER_FIELDS = [
  { key: "assistantRetentionDays", label: "Career assistant history (days)", min: 1, max: 3650, step: "1" },
  { key: "aiRunRetentionDays", label: "AI usage records (days)", min: 1, max: 3650, step: "1" },
  { key: "resumeRetentionDays", label: "Resume reviews (days)", min: 1, max: 3650, step: "1" },
] as const;

export type FieldErrors = Record<string, string[]>;

/** Checkbox values: present ("on"/"true") means checked; absent means unchecked. */
export function booleansFromForm<K extends string>(
  values: Record<string, string>,
  keys: readonly K[],
): Record<K, boolean> {
  const out = {} as Record<K, boolean>;
  for (const key of keys) out[key] = values[key] === "on" || values[key] === "true";
  return out;
}

/**
 * Numeric inputs: an empty field is an error (z.coerce would silently turn it
 * into 0, which for limits means "disabled"). Range checks are left to the schema.
 */
export function numbersFromForm<K extends string>(
  values: Record<string, string>,
  keys: readonly K[],
): { data: Partial<Record<K, number>>; errors: FieldErrors } {
  const data: Partial<Record<K, number>> = {};
  const errors: FieldErrors = {};
  for (const key of keys) {
    const raw = (values[key] ?? "").trim();
    if (raw === "") {
      errors[key] = ["Required"];
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      errors[key] = ["Enter a number"];
      continue;
    }
    data[key] = n;
  }
  return { data, errors };
}

/** Model override: blank means "use the environment default" (null). */
export function parseModelOverride(value: string | undefined): { model: string | null; error?: string } {
  const raw = (value ?? "").trim();
  if (raw === "") return { model: null };
  if (raw.length > 80) return { model: null, error: "Must be at most 80 characters" };
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(raw)) {
    return { model: null, error: "Use letters, numbers, dots, dashes, colons or slashes only" };
  }
  return { model: raw };
}

export function emailSettingsFromForm(values: Record<string, string>) {
  return booleansFromForm(
    values,
    EMAIL_SETTING_FIELDS.map((f) => f.key),
  );
}

export function aiSettingsFromForm(values: Record<string, string>): {
  data: Record<string, unknown>;
  errors: FieldErrors;
} {
  const toggles = booleansFromForm(
    values,
    AI_TOGGLE_FIELDS.map((f) => f.key),
  );
  const numbers = numbersFromForm(
    values,
    AI_NUMBER_FIELDS.map((f) => f.key),
  );
  const model = parseModelOverride(values.model);
  const errors: FieldErrors = { ...numbers.errors };
  if (model.error) errors.model = [model.error];
  return { data: { ...toggles, ...numbers.data, model: model.model }, errors };
}

export function privacySettingsFromForm(values: Record<string, string>) {
  return numbersFromForm(
    values,
    PRIVACY_NUMBER_FIELDS.map((f) => f.key),
  );
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Compact, single-line JSON for audit metadata, truncated for table cells. */
export function compactJson(value: unknown, maxLength = 400): string {
  if (value === null || value === undefined) return "";
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    return "[unserialisable]";
  }
  if (!text || text === "{}" || text === "[]") return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/** Percentage of budget used, clamped to 0–100 for progress bars. 0 budget = unlimited → 0. */
export function budgetPercent(spent: number, budget: number): number {
  if (!Number.isFinite(spent) || !Number.isFinite(budget) || budget <= 0) return 0;
  return Math.min(100, Math.max(0, (spent / budget) * 100));
}

export function formatUsd(value: number | string | null | undefined, digits = 2): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "$0.00";
  // Tiny amounts (single AI calls) need more precision to be meaningful.
  const precision = n > 0 && n < 0.01 ? 4 : digits;
  return `$${n.toFixed(precision)}`;
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? new Intl.NumberFormat("en-IN").format(n) : "0";
}

/** Start of the current calendar month in UTC (matches the budget check in runAiFeature). */
export function utcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
