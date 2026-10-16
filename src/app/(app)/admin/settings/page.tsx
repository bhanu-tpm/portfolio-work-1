import type { Metadata } from "next";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { aiSettingsSchema, emailSettingsSchema, privacySettingsSchema } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { env, isAiConfigured, isEmailConfigured, isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/env";
import { PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { AiSettingsForm, EmailSettingsForm, PrivacySettingsForm } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

interface Integration {
  name: string;
  configured: boolean;
  detail: string;
  /** Env variable names only — never values. */
  vars: string;
}

function integrations(): Integration[] {
  const aiEnabledFlag = env.aiEnabled();
  const aiKey = Boolean(env.openaiApiKey());
  return [
    {
      name: "Supabase (public client)",
      configured: isSupabaseConfigured(),
      detail: "Required for sign-in and all data access.",
      vars: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    },
    {
      name: "Supabase service role",
      configured: isServiceRoleConfigured(),
      detail: "Server-only key for notifications, file storage, AI records, audit logs and bookings.",
      vars: "SUPABASE_SECRET_KEY",
    },
    {
      name: "OpenAI",
      configured: isAiConfigured(),
      detail: !aiEnabledFlag
        ? "Turned off with AI_ENABLED=false."
        : aiKey
          ? `Enabled. Default model: ${env.aiModel()}.`
          : "AI_ENABLED is on but no API key is set.",
      vars: "AI_ENABLED, OPENAI_API_KEY, OPENAI_MODEL",
    },
    {
      name: "Resend email",
      configured: isEmailConfigured(),
      detail: isEmailConfigured()
        ? env.adminNotificationEmail()
          ? "Sending enabled. Admin notification address set."
          : "Sending enabled. ADMIN_NOTIFICATION_EMAIL is not set, so admin emails have no recipient."
        : "Emails are recorded as skipped in Notifications.",
      vars: "RESEND_API_KEY, EMAIL_FROM, ADMIN_NOTIFICATION_EMAIL",
    },
    {
      name: "Cron secret",
      configured: Boolean(env.cronSecret()),
      detail: "Protects the scheduled reminders / retention endpoint.",
      vars: "CRON_SECRET",
    },
  ];
}

/**
 * Reads the saved rows as the admin (RLS: settings.manage) so the forms show what
 * is stored, falling back to schema defaults for missing or invalid rows.
 */
async function loadSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["email", "ai", "privacy"]);
  if (error) console.error("[settings] load failed", error.message);
  const byKey = new Map((data ?? []).map((row) => [row.key as string, row.value as unknown]));
  const pick = (key: string) => byKey.get(key) ?? {};
  const email = emailSettingsSchema.safeParse(pick("email"));
  const ai = aiSettingsSchema.safeParse(pick("ai"));
  const privacy = privacySettingsSchema.safeParse(pick("privacy"));
  return {
    email: email.success ? email.data : emailSettingsSchema.parse({}),
    ai: ai.success ? ai.data : aiSettingsSchema.parse({}),
    privacy: privacy.success ? privacy.data : privacySettingsSchema.parse({}),
    loadFailed: Boolean(error),
  };
}

export default async function SettingsPage() {
  await requireAdmin();
  const { email, ai, privacy, loadFailed } = await loadSettings();
  const items = integrations();
  const serviceRole = isServiceRoleConfigured();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Integrations, notifications, AI controls and data retention."
        eyebrow="Administration"
      />

      <nav aria-label="Settings sections" className="mb-6 flex flex-wrap gap-2 text-sm">
        {[
          ["#integrations", "Integrations"],
          ["#email", "Email notifications"],
          ["#ai", "AI"],
          ["#privacy", "Privacy & retention"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border px-3 py-1 hover:bg-muted">
            {label}
          </a>
        ))}
      </nav>

      <div className="grid gap-6">
        <Section
          title="Integration status"
          description={
            <>
              Read from server environment variables. Secret values are never shown. See{" "}
              <code className="text-xs">docs/SETUP.md</code> and <code className="text-xs">.env.example</code> to
              configure them, then redeploy.
            </>
          }
        >
          <ul id="integrations" className="scroll-mt-24 divide-y">
            {items.map((item) => (
              <li key={item.name} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {item.configured ? (
                      <CheckCircle2 className="size-4 text-success" aria-hidden />
                    ) : (
                      <CircleSlash className="size-4 text-muted-foreground" aria-hidden />
                    )}
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
                  <p className="mt-0.5 text-xs break-words text-muted-foreground">
                    <span className="sr-only">Environment variables: </span>
                    <code>{item.vars}</code>
                  </p>
                </div>
                <StatusBadge tone={item.configured ? "success" : "warning"}>
                  {item.configured ? "Configured" : "Not configured"}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </Section>

        {loadFailed ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            Saved settings couldn&apos;t be loaded, so the forms below show defaults. Refresh before saving to avoid
            overwriting your saved values.
          </p>
        ) : null}

        {!serviceRole ? (
          <p className="rounded-lg bg-warning/10 p-3 text-sm" role="note">
            The service role key is not configured, so the application currently runs with default settings. You can
            still save here; saved values take effect once the key is set.
          </p>
        ) : null}

        <Section
          title="Email notifications"
          description="Choose which events send an email. Every notification is still recorded with its delivery status."
        >
          <div id="email" className="scroll-mt-24">
            <EmailSettingsForm settings={email} emailConfigured={isEmailConfigured()} />
          </div>
        </Section>

        <Section
          title="AI"
          description="AI only assists you: it drafts and suggests, and nothing it produces is applied without your review."
        >
          <div id="ai" className="grid scroll-mt-24 gap-4">
            <p className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">
              Turning AI features off never disables booking, dashboards, requests or outcome management — those
              workflows work fully without AI. Disabled features are hidden or show a friendly message instead.
              {!isAiConfigured() ? " OpenAI is currently not configured, so all AI features are off regardless of these toggles." : null}
            </p>
            <AiSettingsForm settings={ai} defaultModel={env.aiModel()} />
          </div>
        </Section>

        <Section
          title="Privacy & retention"
          description="How long AI-related personal data is kept. Older records are deleted by the scheduled cron job (requires CRON_SECRET and the cron schedule to be configured)."
        >
          <div id="privacy" className="scroll-mt-24">
            <PrivacySettingsForm settings={privacy} />
          </div>
        </Section>
      </div>
    </>
  );
}
