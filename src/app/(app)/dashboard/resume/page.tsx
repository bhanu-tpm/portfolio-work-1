import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isAiFeatureEnabled } from "@/lib/ai/run";
import { getSettings } from "@/lib/settings";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { formatDateTime } from "@/lib/format";
import { RESUME_AREA_LABELS } from "@/lib/ai/student-helpers";
import type { ResumeFeedback } from "@/lib/ai/schemas";
import { Button } from "@/components/ui/button";
import { AiLabel, EmptyState, PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmActionButton } from "@/components/student/confirm-action-button";
import { ResumeForm } from "./resume-form";
import { deleteResumeReview } from "./actions";

export const metadata: Metadata = { title: "Resume review" };

interface ReviewRow {
  id: string;
  status: "pending" | "succeeded" | "failed";
  target_role: string | null;
  feedback: ResumeFeedback | null;
  error_message: string | null;
  created_at: string;
  file: { id: string; original_name: string } | null;
  request: { reference_code: string } | null;
}

const STATUS_META = {
  pending: { label: "In progress", tone: "info" },
  succeeded: { label: "Ready", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
} as const;

export default async function ResumePage() {
  const user = await requireUser("/dashboard/resume");
  const supabase = await createClient();

  const [featureOn, { count: enabledCategories }, { data: reviewRows }, { data: requestRows }, aiSettings] =
    await Promise.all([
      isAiFeatureEnabled("resume_review"),
      supabase
        .from("consultation_categories")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("resume_review_enabled", true),
      supabase
        .from("resume_reviews")
        .select(
          "id, status, target_role, feedback, error_message, created_at, file:files(id, original_name), request:consultation_requests(reference_code)",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("consultation_requests")
        .select("id, reference_code, category:consultation_categories(title)")
        .eq("client_id", user.id)
        .order("submitted_at", { ascending: false }),
      getSettings("ai"),
    ]);

  const available = featureOn && (enabledCategories ?? 0) > 0;
  const reviews = (reviewRows ?? []) as unknown as ReviewRow[];
  const requests = ((requestRows ?? []) as unknown as {
    id: string;
    reference_code: string;
    category: { title: string } | null;
  }[]).map((r) => ({ id: r.id, label: `${r.reference_code} · ${r.category?.title ?? "Consultation"}` }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Optional"
        title="Resume review"
        description="Get AI feedback on the structure and clarity of your resume. Treat it as suggestions to consider — you decide what to change."
      />

      {available ? (
        <Section title="Request feedback" description="Upload a text-based PDF or paste your resume text.">
          <ResumeForm
            requests={requests}
            maxUploadMb={MAX_UPLOAD_BYTES / 1024 / 1024}
            dailyLimit={aiSettings.resumeDailyLimit}
          />
        </Section>
      ) : (
        <EmptyState
          icon={FileText}
          title="AI resume review isn't available right now"
          description="You can still get personal feedback on your resume by booking a consultation."
          action={
            <Button asChild>
              <Link href="/dashboard/requests/new">Book a consultation</Link>
            </Button>
          }
        />
      )}

      <section aria-labelledby="past-reviews" className="space-y-4">
        <h2 id="past-reviews" className="font-sans text-base font-semibold tracking-normal">
          Your reviews
        </h2>
        {reviews.length === 0 ? (
          <EmptyState title="No reviews yet" description="Your feedback will appear here." />
        ) : (
          reviews.map((r) => <ReviewCard key={r.id} review={r} />)
        )}
      </section>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing noted.</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function ReviewCard({ review }: { review: ReviewRow }) {
  const meta = STATUS_META[review.status];
  const f = review.feedback;
  return (
    <article className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-sans text-base font-semibold tracking-normal">
              {review.target_role ? `Target role: ${review.target_role}` : "Resume review"}
            </h3>
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
            {f ? <AiLabel /> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(review.created_at)}
            {review.request ? ` · Linked to ${review.request.reference_code}` : ""}
            {review.file ? "" : " · Pasted text"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {review.file ? (
            <Button asChild variant="outline" size="sm">
              <a href={`/api/files/${review.file.id}`} aria-label={`Download ${review.file.original_name}`}>
                <Download data-icon="inline-start" aria-hidden /> Original PDF
              </a>
            </Button>
          ) : null}
          <ConfirmActionButton
            size="sm"
            variant="ghost"
            triggerLabel="Delete"
            title="Delete this resume review?"
            description="The feedback and any uploaded PDF will be permanently deleted."
            action={deleteResumeReview.bind(null, review.id)}
          />
        </div>
      </header>

      {review.status === "failed" ? (
        <p className="text-sm text-destructive">{review.error_message ?? "The review could not be completed."}</p>
      ) : null}
      {review.status === "pending" ? (
        <p className="text-sm text-muted-foreground">This review did not finish. You can delete it and try again.</p>
      ) : null}

      {f ? (
        <div className="space-y-5">
          <p className="text-sm whitespace-pre-wrap">{f.overallSummary}</p>

          <div>
            <h4 className="mb-1.5 text-sm font-semibold">Strengths</h4>
            <List items={f.strengths} />
          </div>

          {f.areas.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Areas to improve</h4>
              {f.areas.map((a, i) => (
                <div key={i} className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm font-medium">{RESUME_AREA_LABELS[a.area] ?? a.area}</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Observations</p>
                      <List items={a.observations} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Suggestions</p>
                      <List items={a.suggestions} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {f.suggestedRewrites.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Suggested wording</h4>
              <p className="rounded-md bg-warning/10 px-3 py-2 text-xs font-medium">
                Suggested wording — verify before using; never add experience you don&apos;t have.
              </p>
              {f.suggestedRewrites.map((w, i) => (
                <div key={i} className="grid gap-2 rounded-lg border p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Your text</p>
                    <p className="whitespace-pre-wrap">{w.original}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Suggested wording</p>
                    <p className="whitespace-pre-wrap">{w.suggestion}</p>
                  </div>
                  {w.whatToVerify ? (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Check before using:</span> {w.whatToVerify}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <h4 className="mb-1.5 text-sm font-semibold">Missing information</h4>
            <List items={f.missingInformation} />
          </div>
        </div>
      ) : null}
    </article>
  );
}
