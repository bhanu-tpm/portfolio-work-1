/**
 * Validation and generic form messages exactly as the Zod schemas (src/lib/validation)
 * and src/lib/action-result.ts produce them. The Hindi file uses the same keys, and
 * translateMessage() (src/i18n/translate-message.ts) maps a known English message to it.
 */
export const validation = {
  messages: {
    correctFields: "Please correct the highlighted fields.",
    generic: "Something went wrong. Please try again.",
    tooManyRequests: "Too many requests. Please wait a little and try again.",
    invalidEmail: "Enter a valid email address",
    passwordMin: "Use at least 10 characters",
    passwordMax: "Use at most 72 characters",
    passwordMix: "Include at least one letter and one number",
    acceptPrivacy: "Please accept the privacy notice and disclaimer",
    enterPassword: "Enter your password",
    passwordsMismatch: "Passwords do not match",
  },
  /** Templates used by requiredText()/optionalText() in src/lib/validation/common.ts. */
  patterns: {
    required: "{label} is required",
    min: "{label} must be at least {n} characters",
    max: "{label} must be at most {n} characters",
    maxPlain: "Must be at most {n} characters",
  },
  /** Labels passed to requiredText() by the public and auth schemas. */
  labels: {
    name: "Name",
    subject: "Subject",
    message: "Message",
    thisField: "This field",
  },
};

export type ValidationDict = typeof validation;
