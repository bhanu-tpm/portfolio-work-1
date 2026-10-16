import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { OUTCOME_SECTIONS, type ConsultationOutcome, type OutcomeVersion } from "@/lib/db/types";
import { Markdown } from "@/components/shared/markdown";
import { PageHeader } from "@/components/shared/page";

export const metadata: Metadata = { title: "Consultation outcome" };

export default async function OutcomePage({ params }: PageProps<"/dashboard/outcomes/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/outcomes/${id}`);
  const supabase = await createClient();
  const { data: outcome } = await supabase
    .from("consultation_outcomes")
    .select("*")
    .eq("id", id)
    .eq("client_id", user.id)
    .maybeSingle<ConsultationOutcome>();
  if (!outcome || !["published", "superseded"].includes(outcome.status) || !outcome.published_version_id) notFound();

  // RLS only returns the published version of the client's own outcome.
  const { data: version } = await supabase
    .from("outcome_versions")
    .select("*")
    .eq("id", outcome.published_version_id)
    .maybeSingle<OutcomeVersion>();
  if (!version) notFound();

  return (
    <article className="mx-auto max-w-3xl">
      <PageHeader
        title={outcome.title}
        description={`Published ${formatDate(outcome.published_at)}`}
        actions={
          <Button asChild>
            <a href={`/api/outcomes/${outcome.id}/download`}>
              <Download data-icon="inline-start" /> Download PDF
            </a>
          </Button>
        }
      />
      {outcome.status === "superseded" && outcome.superseded_by ? (
        <p className="mb-6 flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm">
          <Info className="size-4 shrink-0" aria-hidden />
          A newer version of this outcome is available.{" "}
          <Link href={`/dashboard/outcomes/${outcome.superseded_by}`} className="text-teal underline">
            View it
          </Link>
        </p>
      ) : null}
      <div className="grid gap-8 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:p-8">
        {OUTCOME_SECTIONS.map((s) =>
          version.content[s.key]?.trim() ? (
            <section key={s.key}>
              <h2 className="text-xl font-semibold">{s.title}</h2>
              <Markdown className="mt-2 text-base">{version.content[s.key]}</Markdown>
            </section>
          ) : null,
        )}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        This plan reflects the consultant&apos;s professional guidance at the time of publication. Verify course details,
        fees and requirements with official sources before acting on them.
      </p>
    </article>
  );
}
