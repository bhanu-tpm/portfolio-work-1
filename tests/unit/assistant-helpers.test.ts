import { describe, expect, it } from "vitest";
import {
  buildSummaryMessage,
  canShareToRequest,
  checkResumeText,
  isSelfHarmCategory,
  normaliseResumeText,
  recentHistory,
  resolveSuggestedCategories,
  selectModerationResponse,
} from "@/lib/ai/student-helpers";
import {
  RESUME_TEXT_MAX,
  SUMMARY_MAX,
  SUMMARY_MESSAGE_PREFIX,
  assistantMessageSchema,
  resumeReviewSchema,
  saveSummarySchema,
} from "@/lib/validation/student-ai";

const UUID = "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b";

describe("assistantMessageSchema", () => {
  it("accepts a trimmed message and optional conversation id", () => {
    const r = assistantMessageSchema.safeParse({ message: "  What can I do with a BSc?  ", conversationId: null });
    expect(r.success && r.data.message).toBe("What can I do with a BSc?");
    expect(assistantMessageSchema.safeParse({ message: "hi", conversationId: UUID }).success).toBe(true);
  });

  it("rejects empty, whitespace-only and over-long messages", () => {
    expect(assistantMessageSchema.safeParse({ message: "" }).success).toBe(false);
    expect(assistantMessageSchema.safeParse({ message: "   " }).success).toBe(false);
    expect(assistantMessageSchema.safeParse({ message: "a".repeat(2001) }).success).toBe(false);
    expect(assistantMessageSchema.safeParse({ message: "a".repeat(2000) }).success).toBe(true);
  });

  it("rejects a malformed conversation id", () => {
    expect(assistantMessageSchema.safeParse({ message: "hi", conversationId: "abc" }).success).toBe(false);
  });
});

describe("moderation response", () => {
  it("detects self-harm categories in either naming style", () => {
    expect(isSelfHarmCategory("self-harm")).toBe(true);
    expect(isSelfHarmCategory("self-harm/intent")).toBe(true);
    expect(isSelfHarmCategory("self_harm_instructions")).toBe(true);
    expect(isSelfHarmCategory("harassment")).toBe(false);
  });

  it("includes crisis resources for self-harm", () => {
    const r = selectModerationResponse(["violence", "self-harm/intent"]);
    expect(r.crisis).toBe(true);
    expect(r.reply).toContain("14416");
    expect(r.reply).toMatch(/emergency services/i);
  });

  it("returns a neutral redirect for other categories", () => {
    const r = selectModerationResponse(["harassment"]);
    expect(r.crisis).toBe(false);
    expect(r.reply).not.toContain("14416");
    expect(r.reply).toMatch(/career/i);
  });
});

describe("conversation helpers", () => {
  it("keeps only the most recent messages", () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({ role: "user" as const, content: String(i) }));
    const h = recentHistory(msgs, 16);
    expect(h).toHaveLength(16);
    expect(h[0].content).toBe("4");
    expect(h.at(-1)?.content).toBe("19");
  });

  it("maps suggested slugs to active categories, deduplicated and capped", () => {
    const cats = [
      { id: "1", slug: "career-clarity", title: "Career clarity" },
      { id: "2", slug: "study-abroad", title: "Study abroad" },
      { id: "3", slug: "resume", title: "Resume" },
    ];
    const out = resolveSuggestedCategories(["unknown", "study-abroad", "study-abroad", "resume", "career-clarity"], cats);
    expect(out.map((c) => c.id)).toEqual(["2", "3"]);
  });

  it("only allows sharing to open requests", () => {
    expect(canShareToRequest("submitted")).toBe(true);
    expect(canShareToRequest("more_info_required")).toBe(true);
    expect(canShareToRequest("declined")).toBe(false);
    expect(canShareToRequest("completed")).toBe(false);
  });

  it("builds the shared summary message within the request_messages limit", () => {
    const body = buildSummaryMessage("  The student is exploring data roles.  ");
    expect(body.startsWith(SUMMARY_MESSAGE_PREFIX)).toBe(true);
    expect(body.endsWith("exploring data roles.")).toBe(true);
    expect(buildSummaryMessage("x".repeat(SUMMARY_MAX)).length).toBeLessThanOrEqual(4000);
  });

  it("requires explicit confirmation to share a summary", () => {
    const base = { conversationId: UUID, requestId: UUID, summary: "A useful summary of the chat." };
    expect(saveSummarySchema.safeParse({ ...base, confirm: false }).success).toBe(false);
    expect(saveSummarySchema.safeParse({ ...base, confirm: true }).success).toBe(true);
    expect(saveSummarySchema.safeParse({ ...base, summary: "x".repeat(SUMMARY_MAX + 1), confirm: true }).success).toBe(false);
  });
});

describe("resume text checks", () => {
  const longText =
    "Asha Example — Junior Analyst\nSkills: SQL, Excel, Python\nExperience: Intern at Example Corp, built dashboards for weekly sales reporting and cleaned survey data for a college project.\nEducation: BSc Statistics, Example University, 2025. Projects: forecasting coursework, data visualisation club lead.";

  it("normalises whitespace while keeping line breaks", () => {
    expect(normaliseResumeText("a  \t b\n\n\n\n c \u0000")).toBe("a b\n\nc");
  });

  it("rejects empty or near-empty PDF text with a scanned-PDF hint", () => {
    const empty = checkResumeText("   \n  ", "pdf");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.message).toMatch(/scanned/i);
    const short = checkResumeText("Name Skills", "pdf");
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.reason).toBe("too_short");
  });

  it("accepts a realistic resume and truncates over-long text", () => {
    const ok = checkResumeText(longText, "text");
    expect(ok.ok).toBe(true);
    const long = checkResumeText(longText.repeat(100), "pdf");
    expect(long.ok).toBe(true);
    if (long.ok) {
      expect(long.truncated).toBe(true);
      expect(long.text.length).toBe(RESUME_TEXT_MAX);
    }
  });

  it("requires consent and validates optional fields", () => {
    expect(resumeReviewSchema.safeParse({ consentProcessing: "" }).success).toBe(false);
    const r = resumeReviewSchema.safeParse({ consentProcessing: "on", requestId: "none", targetRole: "  " });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.requestId).toBeUndefined();
      expect(r.data.targetRole).toBeUndefined();
    }
    expect(resumeReviewSchema.safeParse({ consentProcessing: "on", requestId: "bad" }).success).toBe(false);
    expect(resumeReviewSchema.safeParse({ consentProcessing: "on", pastedText: "a".repeat(RESUME_TEXT_MAX + 1) }).success).toBe(false);
  });
});
