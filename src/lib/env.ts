import "server-only";

/**
 * Typed access to environment variables. Optional integrations report
 * "not configured" instead of silently pretending to work.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export type AiProviderName = "openai" | "gemini";

export const env = {
  siteUrl: () => read("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
  siteName: () => read("NEXT_PUBLIC_SITE_NAME") ?? "Margith",

  supabaseUrl: () => read("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () =>
    read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseSecretKey: () => read("SUPABASE_SECRET_KEY") ?? read("SUPABASE_SERVICE_ROLE_KEY"),

  openaiApiKey: () => read("OPENAI_API_KEY"),
  geminiApiKey: () => read("GEMINI_API_KEY"),
  aiEnabled: () => read("AI_ENABLED") !== "false",
  /** Which AI provider handles requests: "openai" (default) or "gemini". */
  aiProvider: (): AiProviderName => (read("AI_PROVIDER")?.toLowerCase() === "gemini" ? "gemini" : "openai"),
  /** API key for the selected provider. */
  aiApiKey: () => (env.aiProvider() === "gemini" ? env.geminiApiKey() : env.openaiApiKey()),
  aiModel: () =>
    env.aiProvider() === "gemini"
      ? (read("GEMINI_MODEL") ?? "gemini-flash-latest")
      : (read("OPENAI_MODEL") ?? "gpt-5-mini"),
  aiTimeoutMs: () => Number(read("AI_TIMEOUT_MS") ?? 45_000),
  /**
   * USD per 1M tokens, used for cost estimates and the monthly budget only.
   * Gemini defaults to 0 because the free tier costs nothing; set GEMINI_*_PRICE_PER_MTOK on a paid plan.
   */
  aiInputPricePerMTok: () =>
    env.aiProvider() === "gemini"
      ? Number(read("GEMINI_INPUT_PRICE_PER_MTOK") ?? 0)
      : Number(read("AI_INPUT_PRICE_PER_MTOK") ?? 0.25),
  aiOutputPricePerMTok: () =>
    env.aiProvider() === "gemini"
      ? Number(read("GEMINI_OUTPUT_PRICE_PER_MTOK") ?? 0)
      : Number(read("AI_OUTPUT_PRICE_PER_MTOK") ?? 2),

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
  return env.aiEnabled() && Boolean(env.aiApiKey());
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
