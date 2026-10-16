import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/server";
import { signedDownloadUrl } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { buildOutcomePdf, pdfFileName } from "@/lib/outcomes";
import { resolveDownloadableVersion } from "@/lib/outcome-access";
import type { ConsultationOutcome, FileRecord, OutcomeVersion } from "@/lib/db/types";

/**
 * Outcome document download.
 * - Clients: only their own outcome, only once published (or superseded), only the published version.
 * - Admin: any version (?version=<id>) for preview.
 * Never relies on what the UI shows; every check happens here.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/outcomes/[id]/download">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: outcome } = await admin
    .from("consultation_outcomes")
    .select("*")
    .eq("id", id)
    .maybeSingle<ConsultationOutcome>();
  if (!outcome) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versionId = resolveDownloadableVersion(user, outcome, request.nextUrl.searchParams.get("version"));
  if (!versionId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: version } = await admin
    .from("outcome_versions")
    .select("*")
    .eq("id", versionId)
    .eq("outcome_id", outcome.id)
    .maybeSingle<OutcomeVersion>();
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit(user.id, user.isAdmin ? "outcome.previewed" : "outcome.downloaded", "consultation_outcome", outcome.id, {
    version_id: version.id,
  });

  // Uploaded PDF takes precedence; otherwise render from the approved structured content.
  if (version.file_id) {
    const { data: file } = await admin.from("files").select("*").eq("id", version.file_id).maybeSingle<FileRecord>();
    if (file) {
      const url = await signedDownloadUrl(file.bucket, file.path, pdfFileName(outcome.title));
      return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
    }
  }

  const pdf = await buildOutcomePdf(outcome, version);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFileName(outcome.title)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
