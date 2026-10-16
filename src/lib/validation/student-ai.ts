import { z } from "zod";
import { checkbox, optionalText, uuid } from "./common";

// ---------------------------------------------------------------------------
// Career guidance assistant
// ---------------------------------------------------------------------------
export const ASSISTANT_MESSAGE_MAX = 2000;

export const assistantMessageSchema = z.object({
  conversationId: uuid.nullish(),
  message: z
    .string({ error: "Please type a message" })
    .trim()
    .min(1, "Please type a message")
    .max(ASSISTANT_MESSAGE_MAX, `Messages can be at most ${ASSISTANT_MESSAGE_MAX} characters`),
});
export type AssistantMessageInput = z.infer<typeof assistantMessageSchema>;

/** Prefix added when a client shares an assistant summary with the consultant. */
export const SUMMARY_MESSAGE_PREFIX = "Summary from AI career guidance (shared by the client):";
/** request_messages.body is limited to 4000 characters. */
export const SUMMARY_MAX = 4000 - SUMMARY_MESSAGE_PREFIX.length - 2;

export const saveSummarySchema = z.object({
  conversationId: uuid,
  requestId: uuid,
  summary: z
    .string()
    .trim()
    .min(10, "The summary is too short to share")
    .max(SUMMARY_MAX, `The summary can be at most ${SUMMARY_MAX} characters`),
  confirm: z.literal(true, { error: "Please confirm that you want to share this summary" }),
});

// ---------------------------------------------------------------------------
// Resume review
// ---------------------------------------------------------------------------
export const RESUME_TEXT_MAX = 20_000;
export const RESUME_TEXT_MIN = 200;

export const resumeReviewSchema = z.object({
  pastedText: optionalText(RESUME_TEXT_MAX),
  targetRole: optionalText(160),
  requestId: z.preprocess((v) => (v === "" || v === "none" ? undefined : v), uuid.optional()),
  consentProcessing: checkbox.refine((v) => v, "Please confirm that your resume may be processed by AI"),
});

export const idSchema = z.object({ id: uuid });
