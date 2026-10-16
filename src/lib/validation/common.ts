import { z } from "zod";

/** Trimmed string; empty input becomes undefined (for optional form fields). */
export const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v),
    z.string().max(max, `Must be at most ${max} characters`).optional(),
  );

export const requiredText = (min: number, max: number, label = "This field") =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const emailField = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254));

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const phoneField = optionalText(30).refine(
  (v) => v === undefined || /^[+()\-\s\d]{6,30}$/.test(v),
  "Enter a valid phone number",
);

export const uuid = z.uuid("Invalid identifier");

export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

export const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\//i.test(v), "Must start with http:// or https://")
  .pipe(z.url());

export const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  httpUrl.optional(),
);
