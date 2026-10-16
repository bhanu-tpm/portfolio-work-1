import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isAiFeatureEnabled } from "@/lib/ai/run";
import { formatDateTime, outcomeStatusMeta } from "@/lib/format";
import type { ConsultationOutcome, OutcomeVersion } from "@/lib/db/types";
import { AiLabel, PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { OutcomeEditor } from "./outcome-editor";
import { ApprovalPanel, PdfUploadForm } from "./approval-panel";

export const metadata: Metadata = { title: "Outcome" };

const SOURCE_LABEL: Record<OutcomeVersion["source"], string> = {
  manual: "Manual",
  ai_draft: "AI draft",
  ai_assisted: "AI-assisted edit",
};

export default async function AdminOutcomePage({ params }: PageProps<"/admin/outcomes/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: outcome } = await supabase
    .from("consultation_outcomes")
    .select("*, request:consultation_requests(id, reference_code, full_name, consent_ai)")
    .eq("id", id)
    .maybeSingle<ConsultationOutcome & { request: { id: string; reference_code: string; full_name: string; consent_ai: boolean } }>();
  if (!outcome) notFound();

  const [{ data: versionRows }, { data: notes }, { data: prep }, aiEnabled] = await Promise.all([
    supabase.from("outcome_versions").select("*").eq("outcome_id", id).order("version_number", { ascending: false }),
    supabase.from("admin_notes").select("id, body").eq("request_id", outcome.request_id).order("created_at", { ascending: false }),
    supabase
      .from("ai_generations")
      .select("id")
      .eq("request_id", outcome.request_id)
      .eq("feature", "intake_analysis")
      .neq("status", "dismissed")
      .limit(1),
    isAiFeatureEnabled("outcome_draft"),
  ]);
  const versions = (versionRows ?? []) as OutcomeVersion[];
  const latest = versions[0];
  if (!latest) notFound();
  const status = outcomeStatusMeta[outcome.status];
  const editable = outcome.status === "draft" || outcome.status === "approved";
  const approvedVersion = versions.find((v) => v.id === outcome.approved_version_id);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={outcome.request.reference_code}
        title={outcome.title}
        description={
          <>
            For {outcome.request.full_name} ·{" "}
            <Link href={`/admin/requests/${outcome.request.id}`} className="text-teal underline">
              View request
            </Link>
          </>
        }
        actions={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Section
            title={`Content — version ${latest.version_number}`}
            description={
              outcome.status === "approved"
                ? "Approved. Saving changes creates a new version and withdraws the approval."
                : editable
                  ? "Edit each section, then save a new version. Every saved version is kept."
                  : "Read-only."
            }
          >
            <OutcomeEditor
              key={latest.id}
              outcomeId={outcome.id}
              initialContent={latest.content}
              latestVersion={latest.version_number}
              latestSource={latest.source}
              editable={editable}
              aiEnabled={aiEnabled}
              consentAi={outcome.request.consent_ai}
              hasPreparation={Boolean(prep?.length)}
              notes={(notes ?? []) as { id: string; body: string }[]}
            />
          </Section>
        </div>

        <div className="grid content-start gap-6">
          <Section title="Approval and publication">
            <ApprovalPanel
              outcomeId={outcome.id}
              status={outcome.status}
              latestVersionId={latest.id}
              latestVersionNumber={latest.version_number}
              approvedVersionNumber={approvedVersion?.version_number ?? null}
            />
            <dl className="mt-4 grid gap-1 border-t pt-4 text-xs text-muted-foreground">
              {outcome.approved_at ? <div>Approved {formatDateTime(outcome.approved_at)}</div> : null}
              {outcome.published_at ? <div>Published {formatDateTime(outcome.published_at)}</div> : null}
              {outcome.superseded_by ? (
                <div>
                  Superseded by{" "}
                  <Link href={`/admin/outcomes/${outcome.superseded_by}`} className="text-teal underline">
                    a newer outcome
                  </Link>
                </div>
              ) : null}
            </dl>
          </Section>

          <Section title="Document">
            <a
              href={`/api/outcomes/${outcome.id}/download?version=${latest.id}`}
              className="inline-flex items-center gap-2 text-sm text-teal hover:underline"
            >
              <Download className="size-4" aria-hidden /> Preview PDF of version {latest.version_number}
            </a>
            {outcome.status === "draft" ? (
              <div className="mt-4 border-t pt-4">
                <PdfUploadForm outcomeId={outcome.id} latestVersionNumber={latest.version_number} />
              </div>
            ) : null}
          </Section>

          <Section title="Version history">
            <ol className="grid gap-3 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="rounded-lg bg-muted/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">Version {v.version_number}</span>
                    {v.source === "ai_draft" ? <AiLabel /> : <span className="text-xs text-muted-foreground">{SOURCE_LABEL[v.source]}</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(v.created_at)}
                    {v.change_note ? ` · ${v.change_note}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {v.id === outcome.approved_version_id ? <StatusBadge tone="info">Approved</StatusBadge> : null}
                    {v.id === outcome.published_version_id ? <StatusBadge tone="success">Published</StatusBadge> : null}
                    {v.file_id ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <FileText className="size-3" aria-hidden /> PDF uploaded
                      </span>
                    ) : null}
                    <a href={`/api/outcomes/${outcome.id}/download?version=${v.id}`} className="text-teal underline">
                      PDF
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
