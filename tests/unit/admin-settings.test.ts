import { describe, expect, it } from "vitest";
import { aiSettingsSchema, emailSettingsSchema, privacySettingsSchema } from "@/lib/settings";
import {
  AI_NUMBER_FIELDS,
  AI_TOGGLE_FIELDS,
  EMAIL_SETTING_FIELDS,
  PRIVACY_NUMBER_FIELDS,
  aiSettingsFromForm,
  emailSettingsFromForm,
  parseModelOverride,
  privacySettingsFromForm,
} from "@/lib/validation/admin";

describe("settings field lists stay in sync with the schemas", () => {
  it("covers every schema key", () => {
    expect(EMAIL_SETTING_FIELDS.map((f) => f.key).sort()).toEqual(Object.keys(emailSettingsSchema.shape).sort());
    expect([...AI_TOGGLE_FIELDS.map((f) => f.key), ...AI_NUMBER_FIELDS.map((f) => f.key), "model"].sort()).toEqual(
      Object.keys(aiSettingsSchema.shape).sort(),
    );
    expect(PRIVACY_NUMBER_FIELDS.map((f) => f.key).sort()).toEqual(Object.keys(privacySettingsSchema.shape).sort());
  });
});

describe("settings form parsing", () => {
  it("treats absent checkboxes as off", () => {
    const parsed = emailSettingsSchema.parse(emailSettingsFromForm({ newRequest: "on", contact: "on" }));
    expect(parsed.newRequest).toBe(true);
    expect(parsed.contact).toBe(true);
    expect(parsed.reminders).toBe(false);
  });

  it("parses AI settings and maps a blank model to null", () => {
    const { data, errors } = aiSettingsFromForm({
      intakeAnalysis: "on",
      model: "  ",
      assistantDailyMessageLimit: "30",
      resumeDailyLimit: "3",
      adminDailyLimit: "200",
      monthlyBudgetUsd: "12.5",
    });
    expect(errors).toEqual({});
    const parsed = aiSettingsSchema.parse(data);
    expect(parsed.model).toBeNull();
    expect(parsed.intakeAnalysis).toBe(true);
    expect(parsed.careerAssistant).toBe(false);
    expect(parsed.monthlyBudgetUsd).toBe(12.5);
  });

  it("rejects empty numbers instead of coercing them to 0", () => {
    const { errors } = aiSettingsFromForm({ assistantDailyMessageLimit: "", resumeDailyLimit: "x" });
    expect(errors.assistantDailyMessageLimit).toEqual(["Required"]);
    expect(errors.resumeDailyLimit).toEqual(["Enter a number"]);
    expect(errors.adminDailyLimit).toEqual(["Required"]);
  });

  it("lets the schema enforce ranges", () => {
    const { data, errors } = privacySettingsFromForm({
      assistantRetentionDays: "0",
      aiRunRetentionDays: "365",
      resumeRetentionDays: "90",
    });
    expect(errors).toEqual({});
    expect(privacySettingsSchema.safeParse(data).success).toBe(false);
  });

  it("validates the model override", () => {
    expect(parseModelOverride("gpt-5-mini")).toEqual({ model: "gpt-5-mini" });
    expect(parseModelOverride("")).toEqual({ model: null });
    expect(parseModelOverride("bad model!").error).toBeDefined();
    expect(parseModelOverride("x".repeat(81)).error).toBeDefined();
  });
});
