import { z } from "zod";

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echo of submitted values so forms keep input after a validation error. */
  values?: Record<string, string>;
  data?: Record<string, unknown>;
};

export const initialActionState: ActionState = { ok: false };

const KNOWN_ERRORS = new Set(["AuthorizationError", "RateLimitError", "ConfigurationError", "UserFacingError"]);

/** An error whose message is safe to show to the user. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function validationFailure(error: z.ZodError, values?: Record<string, string>): ActionState {
  return {
    ok: false,
    message: "Please correct the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
    values,
  };
}

/** Converts an unknown error into a safe ActionState. Unexpected errors are logged, not shown. */
export function failure(error: unknown, fallback = "Something went wrong. Please try again."): ActionState {
  if (error instanceof Error && KNOWN_ERRORS.has(error.name)) {
    return { ok: false, message: error.message };
  }
  console.error("[action] unexpected error", error);
  return { ok: false, message: fallback };
}

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}
