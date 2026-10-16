import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCheck, FilePlus2, FileText, ShieldAlert, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isAiConfigured } from "@/lib/env";
import {
  appointmentStatusMeta,
  formatBytes,
  formatDate,
  formatDateTime,
  formatLabel,
  outcomeStatusMeta,
  requestStatusMeta,
} from "@/lib/format";
import { REQUEST_TRANSITIONS } from "@/lib/workflow";
import type {
  AdminNote,
  AiGeneration,
  Appointment,
  ConsultationOutcome,
  ConsultationRequest,
  FileRecord,
  IntakeQuestion,
  RequestMessage,
  RequestStatusHistory,
} from "@/lib/db/types";
import type { IntakeAnalysis } from "@/lib/ai/schemas";
import { AiLabel, DefinitionList, PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { MessageThread } from "@/components/shared/message-thread";
import { MessageForm } from "@/components/shared/message-form";
import { deleteAdminNote, postAdminMessage, reviewAnalysis } from "../actions";
import { AnalysisEditor, AnalysisView, GenerateAnalysisButton, NoteForm, StatusForm } from "./request-forms";

export const metadata: Metadata = { title: "Request" };

export default async function AdminRequestPage({ params, searchParams }: PageProps<"/admin/requests/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("consultation_requests")
    .select("*, category:consultation_categories(title, intake_questions)")
    .eq("id", id)
    .maybeSingle<ConsultationRequest & { category: { title: string; intake_questions: IntakeQuestion[] } | null }>();
  if (!request) notFound();

  const [history, messages, notes, files, appointments, outcomes, analyses] = await Promise.all([
    supabase.from("request_status_history").select("*").eq("request_id", id).order("created_at"),
    supabase.from("request_messages").select("*").eq("request_id", id).order("created_at"),
    supabase.from("admin_notes").select("*").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("files").select("*").eq("request_id", id).eq("purpose", "request_attachment"),
    supabase.from("appointments").select("*").eq("request_id", id).order("starts_at", { ascending: false }),
    supabase.from("consultation_outcomes").select("id, title, status, created_at").eq("request_id", id).order("created_at"),
    supabase
      .from("ai_generations")
      .select("*")
      .eq("request_id", id)
      .eq("feature", "intake_analysis")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const status = requestStatusMeta[request.status];
  const generations = (analyses.data ?? []) as AiGeneration<IntakeAnalysis>[];
  const current = generations.find((g) => g.status !== "dismissed");
  const showOriginal = sp.original === "1";
  const aiAvailable = isAiConfigured();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={request.reference_code}
        title={request.full_name}
        description={`${request.category?.title ?? "No category"} · submitted ${formatDateTime(request.submitted_at)}`}
        actions={
          <>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/clients/${request.client_id}`}>Client profile</Link>
            </Button>
            {["accepted", "completed"].includes(request.status) ? (
              <Button asChild size="sm">
                <Link href={`/admin/outcomes/new?request=${request.id}`}>
                  <FilePlus2 data-icon="inline-start" /> New outcome
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid min-w-0 content-start gap-6">
          <Section title="Original submission" description="Exactly as submitted by the client. Never modified.">
            <DefinitionList
              items={[
                { label: "Email", value: request.email },
                { label: "Phone", value: request.phone },
                { label: "Current status", value: request.education_status },
                { label: "College or organisation", value: request.organization },
                { label: "Course or specialisation", value: request.course },
                { label: "Preferred format", value: formatLabel(request.preferred_format) },
                { label: "Preferred date", value: request.preferred_date ? formatDate(request.preferred_date) : null },
                { label: "AI-assisted preparation", value: request.consent_ai ? "Consented" : "Not permitted" },
              ]}
            />
            <div className="mt-6 grid gap-4">
              {[
                ["Challenge", request.challenge],
                ["Career goals", request.goals],
                ["Current concerns", request.concerns],
                ["Questions to answer", request.questions],
                ["Expected outcomes", request.expected_outcomes],
                ...Object.entries(request.intake_answers ?? {}).map(([key, value]) => [
                  request.category?.intake_questions.find((q) => q.id === key)?.label ?? key,
                  value,
                ]),
              ].map(([label, value]) =>
                value ? (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">{value}</p>
                  </div>
                ) : null,
              )}
            </div>
            {(files.data as FileRecord[] | null)?.length ? (
              <ul className="mt-6 grid gap-2">
                {(files.data as FileRecord[]).map((f) => (
                  <li key={f.id}>
                    <a href={`/api/files/${f.id}`} className="inline-flex items-center gap-2 text-sm text-teal hover:underline">
                      <FileText className="size-4" aria-hidden /> {f.original_name}
                      <span className="text-muted-foreground">({formatBytes(f.size_bytes)})</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section
            title="AI preparation summary"
            description="Private to you. Suggestions only — verify against the original submission."
            actions={
              request.consent_ai && aiAvailable ? (
                <GenerateAnalysisButton requestId={request.id} hasExisting={Boolean(current)} />
              ) : null
            }
          >
            {!request.consent_ai ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldAlert className="size-4" aria-hidden /> The client did not consent to AI-assisted preparation.
              </p>
            ) : !aiAvailable ? (
              <p className="text-sm text-muted-foreground">AI is not configured. The request can be handled normally.</p>
            ) : !current ? (
              <p className="text-sm text-muted-foreground">
                No analysis yet. It is generated automatically after submission when AI is enabled, or on demand.
              </p>
            ) : (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <AiLabel />
                  <span>Generated {formatDateTime(current.created_at)}</span>
                  {current.status === "edited" ? <StatusBadge tone="info">Edited</StatusBadge> : null}
                  {current.status === "reviewed" ? <StatusBadge tone="success">Reviewed</StatusBadge> : null}
                  {current.edited_content ? (
                    <Link
                      href={showOriginal ? `/admin/requests/${request.id}` : `/admin/requests/${request.id}?original=1`}
                      className="text-teal underline"
                    >
                      {showOriginal ? "Show edited version" : "Show original AI output"}
                    </Link>
                  ) : null}
                </div>
                {showOriginal ? (
                  <AnalysisView analysis={current.content} />
                ) : (
                  <AnalysisEditor
                    key={current.id + current.updated_at}
                    generationId={current.id}
                    requestId={request.id}
                    analysis={current.edited_content ?? current.content}
                  />
                )}
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  {current.status !== "reviewed" ? (
                    <form action={reviewAnalysis}>
                      <input type="hidden" name="generationId" value={current.id} />
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="decision" value="reviewed" />
                      <Button type="submit" variant="outline" size="sm">
                        <CheckCheck /> Mark as reviewed
                      </Button>
                    </form>
                  ) : null}
                  <form action={reviewAnalysis}>
                    <input type="hidden" name="generationId" value={current.id} />
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="decision" value="dismissed" />
                    <Button type="submit" variant="ghost" size="sm">
                      <X /> Ignore analysis
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </Section>

          <Section title="Messages with the client">
            <MessageThread messages={(messages.data ?? []) as RequestMessage[]} viewer="admin" />
            <div className="mt-5 border-t pt-5">
              <MessageForm requestId={request.id} action={postAdminMessage} label="Message the client" />
            </div>
          </Section>
        </div>

        <div className="grid min-w-0 content-start gap-6">
          <Section title="Status">
            {request.client_message ? (
              <div className="mb-4 rounded-lg bg-muted p-3 text-sm">
                <p className="text-xs text-muted-foreground">Current message shown to client</p>
                <p className="mt-1 whitespace-pre-wrap">{request.client_message}</p>
              </div>
            ) : null}
            <StatusForm requestId={request.id} allowed={REQUEST_TRANSITIONS[request.status]} />
            <ol className="mt-6 space-y-1.5 border-t pt-4 text-xs text-muted-foreground">
              {((history.data ?? []) as RequestStatusHistory[]).map((h) => (
                <li key={h.id}>
                  {formatDateTime(h.created_at)} — {requestStatusMeta[h.to_status].label}
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Private notes" description="Never visible to the client and never sent to AI unless you select them.">
            <NoteForm requestId={request.id} />
            <ul className="mt-4 grid gap-3">
              {((notes.data ?? []) as AdminNote[]).map((n) => (
                <li key={n.id} className="rounded-lg bg-muted/60 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDateTime(n.created_at)}</span>
                    <form action={deleteAdminNote}>
                      <input type="hidden" name="noteId" value={n.id} />
                      <input type="hidden" name="requestId" value={request.id} />
                      <Button type="submit" variant="ghost" size="icon-xs" aria-label="Delete note">
                        <Trash2 />
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Appointments">
            {(appointments.data as Appointment[] | null)?.length ? (
              <ul className="grid gap-2 text-sm">
                {(appointments.data as Appointment[]).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span>{formatDateTime(a.starts_at, a.timezone)}</span>
                    <StatusBadge tone={appointmentStatusMeta[a.status].tone}>{appointmentStatusMeta[a.status].label}</StatusBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {request.status === "accepted" ? "Waiting for the client to book." : "None yet."}
              </p>
            )}
            <Link href="/admin/appointments" className="mt-3 inline-block text-xs text-teal underline">
              Manage appointments
            </Link>
          </Section>

          <Section title="Outcomes">
            {(outcomes.data as Pick<ConsultationOutcome, "id" | "title" | "status">[] | null)?.length ? (
              <ul className="grid gap-2 text-sm">
                {(outcomes.data as Pick<ConsultationOutcome, "id" | "title" | "status">[]).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/outcomes/${o.id}`} className="truncate text-teal hover:underline">
                      {o.title}
                    </Link>
                    <StatusBadge tone={outcomeStatusMeta[o.status].tone}>{outcomeStatusMeta[o.status].label}</StatusBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No outcome yet.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
