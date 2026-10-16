/**
 * Pure helpers for the student-facing AI features (career assistant and resume
 * review). No server-only imports so they can be unit tested directly.
 */
import { RESUME_TEXT_MAX, RESUME_TEXT_MIN, SUMMARY_MESSAGE_PREFIX } from "@/lib/validation/student-ai";

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------
export const CRISIS_HELPLINE = "Tele-MANAS 14416";

export function isSelfHarmCategory(category: string) {
  return /^self[-_ ]?harm/i.test(category);
}

export interface ModerationReply {
  reply: string;
  /** True when the reply includes crisis-support information. */
  crisis: boolean;
}

/**
 * A safe, supportive reply used instead of calling the model when a message is
 * flagged by moderation. Self-harm categories always get crisis resources.
 */
export function selectModerationResponse(categories: string[]): ModerationReply {
  if (categories.some(isSelfHarmCategory)) {
    return {
      crisis: true,
      reply: [
        "I'm really sorry you're going through this. You don't have to face it alone.",
        `If you are in immediate danger, please contact your local emergency services now (112 in India). You can also call the free, confidential ${CRISIS_HELPLINE} helpline (India), available 24/7, or reach out to someone you trust — a friend, family member, teacher or counsellor.`,
        "I'm an AI assistant and can't provide the support you deserve right now, but talking to a person can help.",
      ].join("\n\n"),
    };
  }
  return {
    crisis: false,
    reply:
      "I can't help with that message. I'm here for career and education questions — for example your interests, skills, study options or next steps. If something is worrying you, consider talking to someone you trust or booking a consultation.",
  };
}

// ---------------------------------------------------------------------------
// Conversation helpers
// ---------------------------------------------------------------------------
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Keep the most recent messages for the model context, oldest first. */
export function recentHistory(messages: ChatMessage[], max = 16): ChatMessage[] {
  return messages.slice(-max);
}

export function buildSummaryMessage(summary: string) {
  return `${SUMMARY_MESSAGE_PREFIX}\n\n${summary.trim()}`;
}

/** Map model-suggested category slugs to active categories (ids are used in links). */
export function resolveSuggestedCategories<T extends { slug: string }>(slugs: string[], categories: T[]): T[] {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const seen = new Set<string>();
  const out: T[] = [];
  for (const slug of slugs) {
    const c = bySlug.get(slug);
    if (c && !seen.has(slug)) {
      seen.add(slug);
      out.push(c);
    }
  }
  return out.slice(0, 2);
}

/** Requests that can still receive client messages. */
export function canShareToRequest(status: string) {
  return status !== "declined" && status !== "completed";
}

// ---------------------------------------------------------------------------
// Resume text
// ---------------------------------------------------------------------------
/** Collapse whitespace produced by PDF extraction while keeping line breaks. */
export function normaliseResumeText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ResumeTextCheck =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; reason: "too_short" | "empty"; message: string };

export function checkResumeText(raw: string, source: "pdf" | "text"): ResumeTextCheck {
  const text = normaliseResumeText(raw);
  const meaningful = text.replace(/[^\p{L}\p{N}]/gu, "").length;
  if (meaningful === 0) {
    return {
      ok: false,
      reason: "empty",
      message:
        source === "pdf"
          ? "We couldn't find any text in this PDF. It may be a scanned image — please export your resume as a text-based PDF or paste the text instead."
          : "Please paste the text of your resume.",
    };
  }
  if (meaningful < RESUME_TEXT_MIN) {
    return {
      ok: false,
      reason: "too_short",
      message:
        source === "pdf"
          ? "We could only read a little text from this PDF. If it is a scanned image, please export a text-based PDF or paste the text instead."
          : `Please paste more of your resume (at least ${RESUME_TEXT_MIN} characters) so the feedback is useful.`,
    };
  }
  const truncated = text.length > RESUME_TEXT_MAX;
  return { ok: true, text: truncated ? text.slice(0, RESUME_TEXT_MAX) : text, truncated };
}

export const RESUME_AREA_LABELS: Record<string, string> = {
  structure_and_clarity: "Structure and clarity",
  skills_presentation: "Skills presentation",
  achievement_descriptions: "Achievement descriptions",
  target_role_alignment: "Alignment with target role",
  readability: "Readability",
  completeness: "Completeness",
};
