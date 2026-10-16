// Row types for the tables used by the application. Kept in sync by hand with
// supabase/migrations. (Can be replaced by `supabase gen types` output.)

export type AppRole = "admin" | "client";

export const REQUEST_STATUSES = [
  "submitted",
  "under_review",
  "more_info_required",
  "accepted",
  "declined",
  "completed",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "reschedule_requested",
  "cancellation_requested",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "reschedule_requested",
  "cancellation_requested",
];

export type OutcomeStatus = "draft" | "approved" | "published" | "superseded" | "archived";
export type PostStatus = "draft" | "published" | "unpublished";
export type PortfolioKind = "expertise" | "experience" | "project" | "qualification" | "certification";
export type AiFeature =
  | "intake_analysis"
  | "outcome_draft"
  | "resource_suggestions"
  | "career_assistant"
  | "resume_review";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  education_status: string | null;
  organization: string | null;
  course: string | null;
  timezone: string;
  ai_consent: boolean;
  ai_consent_at: string | null;
  email_notifications: boolean;
  created_at: string;
}

export interface IntakeQuestion {
  id: string;
  label: string;
  label_hi?: string | null;
  type: "text" | "textarea";
  required: boolean;
}

export interface ConsultationCategory {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  scope: string;
  formats: string[];
  duration_minutes: number | null;
  intake_questions: IntakeQuestion[];
  resume_review_enabled: boolean;
  title_hi?: string | null;
  short_description_hi?: string | null;
  scope_hi?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ConsultationRequest {
  id: string;
  reference_code: string;
  client_id: string;
  category_id: string | null;
  status: RequestStatus;
  full_name: string;
  email: string;
  phone: string | null;
  education_status: string;
  organization: string | null;
  course: string | null;
  challenge: string;
  goals: string;
  concerns: string | null;
  questions: string;
  expected_outcomes: string;
  preferred_format: string;
  preferred_date: string | null;
  intake_answers: Record<string, string>;
  consent_privacy: boolean;
  consent_ai: boolean;
  client_message: string | null;
  submitted_at: string;
  updated_at: string;
}

export interface RequestStatusHistory {
  id: number;
  request_id: string;
  from_status: RequestStatus | null;
  to_status: RequestStatus;
  changed_by: string | null;
  client_message: string | null;
  created_at: string;
}

export interface RequestMessage {
  id: string;
  request_id: string;
  author_id: string | null;
  author_role: AppRole;
  body: string;
  created_at: string;
}

export interface AdminNote {
  id: string;
  request_id: string | null;
  client_id: string | null;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface FileRecord {
  id: string;
  bucket: string;
  path: string;
  owner_id: string | null;
  request_id: string | null;
  purpose: "request_attachment" | "outcome_document" | "resume";
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface AvailabilityRule {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface BlockedPeriod {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface Appointment {
  id: string;
  request_id: string;
  client_id: string;
  starts_at: string;
  ends_at: string;
  buffer_minutes: number;
  blocked_from: string;
  blocked_until: string;
  timezone: string;
  format: string;
  status: AppointmentStatus;
  meeting_details: string | null;
  client_note: string | null;
  change_request_reason: string | null;
  change_requested_at: string | null;
  cancellation_reason: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
}

export interface OutcomeContent {
  overview: string;
  goalsAndChallenges: string;
  discussionPoints: string;
  recommendations: string;
  skillsAndResources: string;
  actionPlan: string;
  milestones: string;
  followUp: string;
}

export const OUTCOME_SECTIONS: { key: keyof OutcomeContent; title: string }[] = [
  { key: "overview", title: "Consultation overview" },
  { key: "goalsAndChallenges", title: "Client goals and challenges" },
  { key: "discussionPoints", title: "Key discussion points" },
  { key: "recommendations", title: "Personalised recommendations" },
  { key: "skillsAndResources", title: "Suggested skills and learning resources" },
  { key: "actionPlan", title: "Action plan" },
  { key: "milestones", title: "Suggested milestones and review dates" },
  { key: "followUp", title: "Follow-up recommendations" },
];

export interface ConsultationOutcome {
  id: string;
  request_id: string;
  client_id: string;
  appointment_id: string | null;
  title: string;
  status: OutcomeStatus;
  approved_version_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_version_id: string | null;
  published_by: string | null;
  published_at: string | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutcomeVersion {
  id: string;
  outcome_id: string;
  version_number: number;
  content: OutcomeContent;
  source: "manual" | "ai_draft" | "ai_assisted";
  ai_generation_id: string | null;
  file_id: string | null;
  change_note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BlogCategory {
  id: string;
  slug: string;
  name: string;
  name_hi?: string | null;
}

export interface BlogTag {
  id: string;
  slug: string;
  name: string;
  name_hi?: string | null;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  category_id: string | null;
  status: PostStatus;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  reading_minutes: number;
  created_at: string;
  updated_at: string;
  title_hi?: string | null;
  excerpt_hi?: string | null;
  content_hi?: string | null;
  seo_title_hi?: string | null;
  seo_description_hi?: string | null;
  cover_image_alt_hi?: string | null;
}

export interface SiteProfile {
  full_name: string;
  headline: string;
  short_bio: string;
  long_bio: string;
  approach: string;
  photo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  location: string | null;
  social_links: { label: string; url: string }[];
  credibility_points: string[];
  headline_hi?: string | null;
  short_bio_hi?: string | null;
  long_bio_hi?: string | null;
  approach_hi?: string | null;
  location_hi?: string | null;
  credibility_points_hi?: string[];
}

export interface PortfolioItem {
  id: string;
  kind: PortfolioKind;
  title: string;
  subtitle: string | null;
  description: string | null;
  period: string | null;
  url: string | null;
  sort_order: number;
  is_visible: boolean;
  title_hi?: string | null;
  subtitle_hi?: string | null;
  description_hi?: string | null;
  period_hi?: string | null;
}

export interface AiRun {
  id: string;
  feature: AiFeature;
  status: "pending" | "succeeded" | "failed";
  model: string;
  user_id: string | null;
  request_id: string | null;
  outcome_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  latency_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AiGeneration<T = unknown> {
  id: string;
  feature: AiFeature;
  ai_run_id: string | null;
  request_id: string | null;
  outcome_id: string | null;
  content: T;
  edited_content: T | null;
  status: "generated" | "edited" | "reviewed" | "dismissed";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  type: string;
  channel: "email" | "in_app";
  recipient_email: string | null;
  subject: string;
  body: string;
  link: string | null;
  status: "queued" | "sent" | "failed" | "skipped";
  error: string | null;
  read_at: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
