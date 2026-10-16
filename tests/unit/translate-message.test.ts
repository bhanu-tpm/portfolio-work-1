import { describe, expect, it } from "vitest";
import { translateMessage, translateState } from "@/i18n/translate-message";
import { contactSchema, resetPasswordSchema, signUpSchema } from "@/lib/validation/schemas";
import { validationFailure } from "@/lib/action-result";
import { dictionaries } from "@/i18n/dictionaries";

describe("translateMessage", () => {
  it("returns English messages unchanged for English", () => {
    expect(translateMessage("en", "Enter a valid email address")).toBe("Enter a valid email address");
  });

  it("translates exact known messages to Hindi", () => {
    expect(translateMessage("hi", "Enter a valid email address")).toBe("मान्य ईमेल पता दर्ज करें");
    expect(translateMessage("hi", "Please correct the highlighted fields.")).toBe("कृपया चिह्नित फ़ील्ड ठीक करें।");
  });

  it("translates requiredText templates with known labels", () => {
    expect(translateMessage("hi", "Name is required")).toBe("नाम ज़रूरी है");
    expect(translateMessage("hi", "Message must be at least 10 characters")).toBe("संदेश में कम से कम 10 वर्ण होने चाहिए");
    expect(translateMessage("hi", "Subject must be at most 160 characters")).toBe("विषय में अधिकतम 160 वर्ण हो सकते हैं");
    expect(translateMessage("hi", "Must be at most 30 characters")).toBe("अधिकतम 30 वर्ण हो सकते हैं");
  });

  it("leaves unknown messages and labels as they are", () => {
    expect(translateMessage("hi", "Password should be stronger")).toBe("Password should be stronger");
    expect(translateMessage("hi", "Headline is required")).toBe("Headline is required");
    expect(translateMessage("hi", "")).toBe("");
  });

  it("covers every message the public and auth schemas produce", () => {
    const cases = [
      contactSchema.safeParse({ name: "", email: "x", subject: "a", message: "short", startedAt: 1 }),
      signUpSchema.safeParse({ fullName: "A", email: "bad", password: "short", acceptTerms: "" }),
      signUpSchema.safeParse({ fullName: "Asha", email: "asha@example.com", password: "onlyletters", acceptTerms: "on" }),
      resetPasswordSchema.safeParse({ password: "abcdefghij1", confirm: "different1" }),
    ];
    for (const result of cases) {
      expect(result.success).toBe(false);
      if (result.success) continue;
      const state = translateState("hi", validationFailure(result.error));
      for (const messages of Object.values(state.fieldErrors ?? {})) {
        for (const message of messages ?? []) expect(message).toMatch(/[ऀ-ॿ]/);
      }
      expect(state.message).toBe(dictionaries.hi.validation.messages.correctFields);
    }
  });
});

describe("translateState", () => {
  it("keeps the state untouched for English", () => {
    const state = { ok: false, message: "Name is required" };
    expect(translateState("en", state)).toBe(state);
  });
});
