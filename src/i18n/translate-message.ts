import type { ActionState } from "@/lib/action-result";
import type { Locale } from "./config";
import { dictionaries } from "./dictionaries";

/**
 * Validation messages come from shared Zod schemas in English. This maps a known
 * English message (exact text or a requiredText()/optionalText() template) to the
 * locale's wording; unknown messages are returned unchanged.
 */
export function translateMessage(locale: Locale, message: string): string {
  if (locale === "en" || !message) return message;
  const en = dictionaries.en.validation;
  const target = dictionaries[locale].validation;

  for (const key of Object.keys(en.messages) as (keyof typeof en.messages)[]) {
    if (en.messages[key] === message) return target.messages[key];
  }

  for (const key of Object.keys(en.patterns) as (keyof typeof en.patterns)[]) {
    const match = templateRegex(en.patterns[key]).exec(message);
    if (!match?.groups) continue;
    const { label, n } = match.groups;
    let translatedLabel: string | undefined;
    if (label !== undefined) {
      const labelKey = (Object.keys(en.labels) as (keyof typeof en.labels)[]).find((k) => en.labels[k] === label);
      if (!labelKey) continue;
      translatedLabel = target.labels[labelKey];
    }
    return target.patterns[key].replace("{label}", translatedLabel ?? "").replace("{n}", n ?? "");
  }
  return message;
}

function templateRegex(template: string) {
  const escaped = template.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace("{label}", "(?<label>.+?)").replace("{n}", "(?<n>\\d+)")}$`);
}

/** Returns the action state with its message and field errors translated for display. */
export function translateState(locale: Locale, state: ActionState): ActionState {
  if (locale === "en") return state;
  const t = (m: string) => translateMessage(locale, m);
  return {
    ...state,
    message: state.message ? t(state.message) : state.message,
    fieldErrors: state.fieldErrors
      ? Object.fromEntries(Object.entries(state.fieldErrors).map(([k, v]) => [k, v?.map(t)]))
      : state.fieldErrors,
  };
}
