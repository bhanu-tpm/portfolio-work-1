import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { renderOutcomePdf } from "@/lib/pdf/outcome-pdf";
import { getSiteProfile } from "@/lib/content";
import type { ConsultationOutcome, OutcomeVersion } from "@/lib/db/types";

/** Builds the PDF for an outcome version from its structured content. */
export async function buildOutcomePdf(outcome: ConsultationOutcome, version: OutcomeVersion) {
  const admin = createAdminClient();
  const [{ data: request }, profile] = await Promise.all([
    admin
      .from("consultation_requests")
      .select("reference_code, full_name")
      .eq("id", outcome.request_id)
      .maybeSingle(),
    getSiteProfile(),
  ]);
  return renderOutcomePdf(version.content, {
    title: outcome.title,
    clientName: request?.full_name ?? "Client",
    consultantName: profile.full_name,
    referenceCode: request?.reference_code ?? outcome.id.slice(0, 8),
    dateLabel: formatDate(outcome.published_at ?? version.created_at),
    siteName: env.siteName(),
  });
}

export function pdfFileName(title: string) {
  return `${title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "consultation-outcome"}.pdf`;
}
