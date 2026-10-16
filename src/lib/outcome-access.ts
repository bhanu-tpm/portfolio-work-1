import type { ConsultationOutcome } from "@/lib/db/types";

type OutcomeAccessFields = Pick<
  ConsultationOutcome,
  "client_id" | "status" | "approved_by" | "approved_version_id" | "published_version_id"
>;

/**
 * Decides which outcome version (if any) a user may download.
 * Clients: only their own outcome, only after explicit approval and publication,
 * and only the published version. Admins may preview any version.
 */
export function resolveDownloadableVersion(
  user: { id: string; isAdmin: boolean },
  outcome: OutcomeAccessFields,
  requestedVersionId: string | null,
): string | null {
  if (user.isAdmin) {
    return requestedVersionId ?? outcome.published_version_id ?? outcome.approved_version_id;
  }
  const ownsIt = outcome.client_id === user.id;
  const released = (outcome.status === "published" || outcome.status === "superseded") && Boolean(outcome.approved_by);
  if (!ownsIt || !released) return null;
  return outcome.published_version_id;
}
