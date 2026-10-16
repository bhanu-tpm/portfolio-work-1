import type { AppointmentStatus, OutcomeStatus, PostStatus, RequestStatus } from "@/lib/db/types";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export function formatDate(iso: string | null | undefined, timeZone = DEFAULT_TIMEZONE, locale = "en-IN") {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined, timeZone = DEFAULT_TIMEZONE) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone }).format(new Date(iso));
}

export function formatTimeZoneName(timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone, timeZoneName: "short" }).formatToParts(new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const requestStatusMeta: Record<RequestStatus, { label: string; tone: Tone; description: string }> = {
  submitted: { label: "Submitted", tone: "info", description: "Your request has been received." },
  under_review: { label: "Under review", tone: "info", description: "Your request is being reviewed." },
  more_info_required: {
    label: "More information required",
    tone: "warning",
    description: "Please reply with the requested information.",
  },
  accepted: { label: "Accepted", tone: "success", description: "You can now book an appointment." },
  declined: { label: "Declined", tone: "danger", description: "This request could not be taken on." },
  completed: { label: "Completed", tone: "neutral", description: "This consultation is complete." },
};

export const appointmentStatusMeta: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  pending: { label: "Awaiting confirmation", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  reschedule_requested: { label: "Reschedule requested", tone: "warning" },
  cancellation_requested: { label: "Cancellation requested", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  completed: { label: "Completed", tone: "info" },
  no_show: { label: "No-show", tone: "danger" },
};

export const outcomeStatusMeta: Record<OutcomeStatus, { label: string; tone: Tone; clientLabel: string }> = {
  draft: { label: "Draft", tone: "neutral", clientLabel: "Being prepared" },
  approved: { label: "Approved", tone: "info", clientLabel: "Being prepared" },
  published: { label: "Published", tone: "success", clientLabel: "Available" },
  superseded: { label: "Superseded", tone: "neutral", clientLabel: "Replaced by a newer version" },
  archived: { label: "Archived", tone: "neutral", clientLabel: "Archived" },
};

export const postStatusMeta: Record<PostStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "success" },
  unpublished: { label: "Unpublished", tone: "warning" },
};

export const formatLabels: Record<string, string> = {
  video: "Video call",
  phone: "Phone call",
  in_person: "In person",
  chat: "Chat",
};

export function formatLabel(format: string) {
  return formatLabels[format] ?? format.replace(/_/g, " ");
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Up to two initials from a name, ignoring brackets and other punctuation. */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{M}]/gu, "")[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}
