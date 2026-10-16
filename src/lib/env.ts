import "server-only";

/**
 * Typed access to environment variables. Optional integrations report
 * "not configured" instead of silently pretending to work.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export const env = {
  siteUrl: () => read("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
  siteName: () => read("NEXT_PUBLIC_SITE_NAME") ?? "Career Consultation",

  supabaseUrl: () => read("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () =>
    read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseSecretKey: () => read("SUPABASE_SECRET_KEY") ?? read("SUPABASE_SERVICE_ROLE_KEY"),

  openaiApiKey: () => read("OPENAI_API_KEY"),
  aiEnabled: () => read("AI_ENABLED") !== "false",
  aiModel: () => read("OPENAI_MODEL") ?? "gpt-5-mini",
  aiTimeoutMs: () => Number(read("AI_TIMEOUT_MS") ?? 45_000),
  /** USD per 1M tokens, used for cost estimates only. */
  aiInputPricePerMTok: () => Number(read("AI_INPUT_PRICE_PER_MTOK") ?? 0.25),
  aiOutputPricePerMTok: () => Number(read("AI_OUTPUT_PRICE_PER_MTOK") ?? 2),

  resendApiKey: () => read("RESEND_API_KEY"),
  emailFrom: () => read("EMAIL_FROM"),
  adminNotificationEmail: () => read("ADMIN_NOTIFICATION_EMAIL"),

  cronSecret: () => read("CRON_SECRET"),
};

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl() && env.supabasePublishableKey());
}

export function isServiceRoleConfigured() {
  return Boolean(env.supabaseUrl() && env.supabaseSecretKey());
}

export function isAiConfigured() {
  return env.aiEnabled() && Boolean(env.openaiApiKey());
}

export function isEmailConfigured() {
  return Boolean(env.resendApiKey() && env.emailFrom());
}

export class ConfigurationError extends Error {
  constructor(what: string) {
    super(`${what} is not configured. See .env.example and docs/SETUP.md.`);
    this.name = "ConfigurationError";
  }
}
