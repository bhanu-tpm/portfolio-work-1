import { z } from "zod";
import { REQUEST_STATUSES } from "@/lib/db/types";
import {
  checkbox,
  emailField,
  httpUrl,
  optionalText,
  optionalUrl,
  phoneField,
  requiredText,
  slugField,
  uuid,
} from "./common";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const passwordField = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72, "Use at most 72 characters")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Include at least one letter and one number");

export const signUpSchema = z.object({
  fullName: requiredText(2, 120, "Name"),
  email: emailField,
  password: passwordField,
  acceptTerms: checkbox.refine((v) => v, "Please accept the privacy notice and disclaimer"),
});

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password").max(72),
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({ password: passwordField, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------
export const contactSchema = z.object({
  name: requiredText(2, 120, "Name"),
  email: emailField,
  subject: requiredText(2, 160, "Subject"),
  message: requiredText(10, 5000, "Message"),
  // Honeypot: real users never fill this hidden field.
  website: z.string().max(0).optional().or(z.literal("")),
  startedAt: z.coerce.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Consultation requests
// ---------------------------------------------------------------------------
export const EDUCATION_STATUSES = [
  "High school student",
  "Undergraduate student",
  "Postgraduate student",
  "Recent graduate",
  "Working professional (0–3 years)",
  "Working professional (3+ years)",
  "Career break / between roles",
  "Other",
] as const;

export const consultationRequestSchema = z.object({
  categoryId: uuid,
  fullName: requiredText(2, 120, "Name"),
  email: emailField,
  phone: phoneField,
  educationStatus: requiredText(2, 80, "Current status"),
  organization: optionalText(160),
  course: optionalText(160),
  challenge: requiredText(20, 4000, "Description of your challenge"),
  goals: requiredText(5, 3000, "Career goals"),
  concerns: optionalText(3000),
  questions: requiredText(5, 3000, "Questions"),
  expectedOutcomes: requiredText(5, 3000, "Expected outcomes"),
  preferredFormat: requiredText(2, 40, "Preferred format"),
  preferredDate: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.iso.date("Enter a valid date").optional(),
  ),
  consentPrivacy: checkbox.refine((v) => v, "You must accept the privacy notice to continue"),
  acceptDisclaimer: checkbox.refine((v) => v, "You must accept the disclaimer to continue"),
  consentAi: checkbox,
});
export type ConsultationRequestInput = z.infer<typeof consultationRequestSchema>;

export const requestMessageSchema = z.object({
  requestId: uuid,
  body: requiredText(1, 4000, "Message"),
});

export const updateRequestStatusSchema = z.object({
  requestId: uuid,
  status: z.enum(REQUEST_STATUSES),
  clientMessage: optionalText(3000),
});

export const adminNoteSchema = z.object({
  requestId: uuid,
  body: requiredText(1, 10000, "Note"),
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export const intakeQuestionSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Question ids use lowercase letters, numbers and underscores"),
  label: z.string().trim().min(3).max(300),
  /** Optional Hindi label; blank is dropped so the public site falls back to `label`. */
  label_hi: optionalText(300),
  type: z.enum(["text", "textarea"]),
  required: z.boolean(),
});

export const categorySchema = z.object({
  id: uuid.optional(),
  slug: slugField,
  title: requiredText(2, 120, "Title"),
  shortDescription: requiredText(5, 400, "Short description"),
  scope: optionalText(2000),
  titleHi: optionalText(120),
  shortDescriptionHi: optionalText(400),
  scopeHi: optionalText(2000),
  formats: z.array(z.string().trim().min(1).max(40)).min(1, "Select at least one format"),
  durationMinutes: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.coerce.number().int().min(15).max(240).nullable(),
  ),
  intakeQuestions: z.array(intakeQuestionSchema).max(15),
  resumeReviewEnabled: checkbox,
  isActive: checkbox,
});

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------
const timeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const availabilityRuleSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: timeField,
    endTime: timeField,
  })
  .refine((d) => d.endTime > d.startTime, { path: ["endTime"], message: "End must be after start" });

export const blockedPeriodSchema = z
  .object({
    startsAt: z.string().min(1, "Start is required"),
    endsAt: z.string().min(1, "End is required"),
    reason: optionalText(200),
  })
  .refine((d) => d.endsAt > d.startsAt, { path: ["endsAt"], message: "End must be after start" });

export const bookAppointmentSchema = z.object({
  requestId: uuid,
  startsAt: z.iso.datetime({ offset: true }),
  format: requiredText(2, 40, "Format"),
  clientNote: optionalText(1000),
});

export const appointmentChangeRequestSchema = z.object({
  appointmentId: uuid,
  kind: z.enum(["reschedule", "cancel"]),
  reason: requiredText(5, 1000, "Reason"),
});

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------
const section = z.string().max(12000).default("");
export const outcomeContentSchema = z.object({
  overview: section,
  goalsAndChallenges: section,
  discussionPoints: section,
  recommendations: section,
  skillsAndResources: section,
  actionPlan: section,
  milestones: section,
  followUp: section,
});

// ---------------------------------------------------------------------------
// Blog and portfolio
// ---------------------------------------------------------------------------
export const blogPostSchema = z.object({
  id: uuid.optional(),
  title: requiredText(3, 200, "Title"),
  slug: slugField,
  excerpt: optionalText(500),
  content: z.string().max(100_000).default(""),
  categoryId: z.preprocess((v) => (v === "" || v === "none" ? undefined : v), uuid.optional()),
  tags: optionalText(500),
  coverImageUrl: optionalUrl,
  coverImageAlt: optionalText(200),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
  // Optional Hindi versions (blank → null; the public site falls back to English).
  titleHi: optionalText(200),
  excerptHi: optionalText(500),
  contentHi: optionalText(100_000),
  seoTitleHi: optionalText(70),
  seoDescriptionHi: optionalText(170),
  coverImageAltHi: optionalText(200),
});

export const siteProfileSchema = z.object({
  fullName: requiredText(2, 120, "Name"),
  headline: requiredText(5, 200, "Headline"),
  shortBio: requiredText(10, 600, "Short biography"),
  longBio: optionalText(6000),
  approach: optionalText(3000),
  photoUrl: optionalUrl,
  contactEmail: z.preprocess((v) => (v === "" ? undefined : v), emailField.optional()),
  contactPhone: phoneField,
  location: optionalText(120),
  socialLinks: z.array(z.object({ label: z.string().trim().min(1).max(40), url: httpUrl })).max(8),
  credibilityPoints: z.array(z.string().trim().min(2).max(200)).max(8),
  // Optional Hindi versions (blank → null; the public site falls back to English).
  headlineHi: optionalText(200),
  shortBioHi: optionalText(600),
  longBioHi: optionalText(6000),
  approachHi: optionalText(3000),
  locationHi: optionalText(120),
  credibilityPointsHi: z.array(z.string().trim().min(2).max(200)).max(8).default([]),
});

export const portfolioItemSchema = z.object({
  id: uuid.optional(),
  kind: z.enum(["expertise", "experience", "project", "qualification", "certification"]),
  title: requiredText(2, 200, "Title"),
  subtitle: optionalText(200),
  description: optionalText(2000),
  period: optionalText(80),
  titleHi: optionalText(200),
  subtitleHi: optionalText(200),
  descriptionHi: optionalText(2000),
  periodHi: optionalText(80),
  url: optionalUrl,
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isVisible: checkbox,
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export const profileSchema = z.object({
  fullName: requiredText(2, 120, "Name"),
  phone: phoneField,
  educationStatus: optionalText(80),
  organization: optionalText(160),
  course: optionalText(160),
  emailNotifications: checkbox,
  aiConsent: checkbox,
});
