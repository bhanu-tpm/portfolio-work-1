import type { IntakeQuestion, RequestStatus } from "@/lib/db/types";

/** Allowed administrator status transitions for consultation requests. */
export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  submitted: ["under_review", "more_info_required", "accepted", "declined"],
  under_review: ["more_info_required", "accepted", "declined"],
  more_info_required: ["under_review", "accepted", "declined"],
  accepted: ["completed", "declined", "under_review"],
  declined: ["under_review"],
  completed: ["accepted"],
};

export function canTransition(from: RequestStatus, to: RequestStatus) {
  return REQUEST_TRANSITIONS[from].includes(to);
}

/** Statuses for which a message to the client is mandatory. */
export const STATUS_REQUIRES_MESSAGE: RequestStatus[] = ["more_info_required", "declined"];

export const MAX_ANSWER_LENGTH = 2000;

/**
 * Extracts and validates category-specific intake answers from form data
 * (`answer_<questionId>` fields). Unknown keys are ignored.
 */
export function parseIntakeAnswers(
  questions: IntakeQuestion[],
  get: (key: string) => unknown,
): { answers: Record<string, string>; errors: Record<string, string[]> } {
  const answers: Record<string, string> = {};
  const errors: Record<string, string[]> = {};
  for (const q of questions) {
    const raw = get(`answer_${q.id}`);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      if (q.required) errors[`answer_${q.id}`] = ["This question is required"];
      continue;
    }
    if (value.length > MAX_ANSWER_LENGTH) {
      errors[`answer_${q.id}`] = [`Must be at most ${MAX_ANSWER_LENGTH} characters`];
      continue;
    }
    answers[q.id] = value;
  }
  return { answers, errors };
}
