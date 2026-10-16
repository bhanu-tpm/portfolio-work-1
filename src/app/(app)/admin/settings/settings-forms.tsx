"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-result";
import { CheckboxField, FormMessage, SubmitButton, TextField } from "@/components/shared/form";
import {
  AI_NUMBER_FIELDS,
  AI_TOGGLE_FIELDS,
  EMAIL_SETTING_FIELDS,
  PRIVACY_NUMBER_FIELDS,
} from "@/lib/validation/admin";
import { saveAiSettings, saveEmailSettings, savePrivacySettings } from "./actions";

type EmailValues = Record<(typeof EMAIL_SETTING_FIELDS)[number]["key"], boolean>;
type AiValues = Record<(typeof AI_TOGGLE_FIELDS)[number]["key"], boolean> &
  Record<(typeof AI_NUMBER_FIELDS)[number]["key"], number> & { model: string | null };
type PrivacyValues = Record<(typeof PRIVACY_NUMBER_FIELDS)[number]["key"], number>;

export function EmailSettingsForm({ settings, emailConfigured }: { settings: EmailValues; emailConfigured: boolean }) {
  const [state, action] = useActionState(saveEmailSettings, initialActionState);
  return (
    <form action={action} className="grid gap-4">
      {!emailConfigured ? (
        <p className="rounded-lg bg-warning/10 p-3 text-sm">
          Resend is not configured, so emails are recorded as <strong>skipped</strong> regardless of these toggles.
          In-app notifications still work.
        </p>
      ) : null}
      <fieldset className="grid gap-3">
        <legend className="sr-only">Email notification types</legend>
        {EMAIL_SETTING_FIELDS.map((f) => (
          <CheckboxField
            key={f.key}
            name={f.key}
            label={f.label}
            description={f.description}
            defaultChecked={settings[f.key]}
            state={state}
          />
        ))}
      </fieldset>
      <FormMessage state={state} />
      <div>
        <SubmitButton>Save email settings</SubmitButton>
      </div>
    </form>
  );
}

export function AiSettingsForm({ settings, defaultModel }: { settings: AiValues; defaultModel: string }) {
  const [state, action] = useActionState(saveAiSettings, initialActionState);
  return (
    <form action={action} className="grid gap-6">
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">Features</legend>
        {AI_TOGGLE_FIELDS.map((f) => (
          <CheckboxField
            key={f.key}
            name={f.key}
            label={f.label}
            description={f.description}
            defaultChecked={settings[f.key]}
            state={state}
          />
        ))}
      </fieldset>

      <TextField
        name="model"
        label="Model override"
        defaultValue={settings.model ?? ""}
        placeholder={defaultModel}
        maxLength={80}
        state={state}
        description={`Leave blank to use the environment default (${defaultModel}).`}
      />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Limits and budget</legend>
        {AI_NUMBER_FIELDS.map((f) => (
          <TextField
            key={f.key}
            name={f.key}
            label={f.label}
            // TextField has no `step`, and a number input defaults to step=1, which
            // would block decimal budgets in the browser. The server validates either way.
            type={f.step === "1" ? "number" : "text"}
            min={String(f.min)}
            max={String(f.max)}
            defaultValue={settings[f.key]}
            state={state}
            required
            description={
              f.key === "monthlyBudgetUsd"
                ? "AI calls stop for the rest of the month once estimated spend reaches this amount. 0 = no budget cap."
                : "0 disables this for everyone."
            }
          />
        ))}
      </fieldset>

      <FormMessage state={state} />
      <div>
        <SubmitButton>Save AI settings</SubmitButton>
      </div>
    </form>
  );
}

export function PrivacySettingsForm({ settings }: { settings: PrivacyValues }) {
  const [state, action] = useActionState(savePrivacySettings, initialActionState);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {PRIVACY_NUMBER_FIELDS.map((f) => (
          <TextField
            key={f.key}
            name={f.key}
            label={f.label}
            type="number"
            min={String(f.min)}
            max={String(f.max)}
            defaultValue={settings[f.key]}
            state={state}
            required
          />
        ))}
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton>Save retention settings</SubmitButton>
      </div>
    </form>
  );
}
