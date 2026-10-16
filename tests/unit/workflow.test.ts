import { describe, expect, it } from "vitest";
import { canTransition, parseIntakeAnswers } from "@/lib/workflow";
import { safeNext } from "@/lib/auth/redirect";
import { consultationRequestSchema, contactSchema } from "@/lib/validation/schemas";
import { escapeHtml, renderEmail } from "@/lib/email/template";

describe("request status transitions", () => {
  it("allows the normal lifecycle", () => {
    expect(canTransition("submitted", "under_review")).toBe(true);
    expect(canTransition("under_review", "accepted")).toBe(true);
    expect(canTransition("accepted", "completed")).toBe(true);
  });
  it("blocks skipping straight from submitted to completed", () => {
    expect(canTransition("submitted", "completed")).toBe(false);
    expect(canTransition("declined", "completed")).toBe(false);
  });
});

describe("parseIntakeAnswers", () => {
  const questions = [
    { id: "interests", label: "Interests", type: "textarea" as const, required: true },
    { id: "paths", label: "Paths", type: "textarea" as const, required: false },
  ];
  it("requires required answers and ignores unknown fields", () => {
    const data: Record<string, string> = { answer_paths: " design ", answer_injected: "x" };
    const { answers, errors } = parseIntakeAnswers(questions, (k) => data[k]);
    expect(answers).toEqual({ paths: "design" });
    expect(errors).toHaveProperty("answer_interests");
  });
  it("limits answer length", () => {
    const { errors } = parseIntakeAnswers(questions, (k) => (k === "answer_interests" ? "a".repeat(2001) : ""));
    expect(errors.answer_interests[0]).toMatch(/at most/);
  });
});

describe("safeNext", () => {
  it("blocks open redirects", () => {
    expect(safeNext("/dashboard/requests")).toBe("/dashboard/requests");
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil.example")).toBe("/dashboard");
    expect(safeNext(undefined)).toBe("/dashboard");
  });
});

describe("consultation request validation", () => {
  const base = {
    categoryId: "6f1c2a7e-9d0b-4c8e-8f4a-1b2c3d4e5f60",
    fullName: "Test Client",
    email: "Client@Example.com ",
    educationStatus: "Undergraduate student",
    challenge: "I need help choosing between two specialisations next year.",
    goals: "Work in research",
    questions: "Which option fits?",
    expectedOutcomes: "A clear decision",
    preferredFormat: "video",
    consentPrivacy: "on",
  };
  it("normalises input", () => {
    const parsed = consultationRequestSchema.parse(base);
    expect(parsed.email).toBe("client@example.com");
    expect(parsed.consentAi).toBe(false);
    expect(parsed.phone).toBeUndefined();
  });
  it("requires privacy consent", () => {
    const result = consultationRequestSchema.safeParse({ ...base, consentPrivacy: undefined });
    expect(result.success).toBe(false);
  });
  it("rejects a too-short challenge description", () => {
    expect(consultationRequestSchema.safeParse({ ...base, challenge: "help" }).success).toBe(false);
  });
});

describe("contact validation", () => {
  it("rejects a filled honeypot", () => {
    const result = contactSchema.safeParse({
      name: "Bot",
      email: "bot@example.com",
      subject: "Hello",
      message: "Buy something now please",
      website: "http://spam.example",
      startedAt: "1",
    });
    expect(result.success).toBe(false);
  });
});

describe("email template", () => {
  it("escapes user-provided content", () => {
    const { html } = renderEmail({
      siteName: "Site",
      heading: "<script>alert(1)</script>",
      paragraphs: ['"quoted" & <b>bold</b>'],
      cta: { url: 'https://x.test/?a="b"', label: "Open" },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain(escapeHtml("<b>bold</b>"));
    expect(html).toContain("&quot;b&quot;");
  });
});
