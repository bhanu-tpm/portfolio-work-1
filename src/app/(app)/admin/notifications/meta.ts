import type { Notification } from "@/lib/db/types";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const notificationStatusMeta: Record<Notification["status"], { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "info" },
  sent: { label: "Sent", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  skipped: { label: "Skipped", tone: "neutral" },
};
