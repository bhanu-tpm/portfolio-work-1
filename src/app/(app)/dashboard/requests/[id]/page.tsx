import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, CheckCircle2, FileText, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  appointmentStatusMeta,
  formatBytes,
  formatDate,
  formatDateTime,
  formatLabel,
  outcomeStatusMeta,
  requestStatusMeta,
} from "@/lib/format";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  type Appointment,
  type ConsultationOutcome,
  type ConsultationRequest,
  type FileRecord,
  type IntakeQuestion,
  type RequestMessage,
  type RequestStatusHistory,
} from "@/lib/db/types";
import { DefinitionList, PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { MessageThread } from "@/components/shared/message-thread";
import { MessageForm } from "@/components/shared/message-form";
import { postClientMessage } from "../actions";

export const metadata: Metadata = { title: "Consultation request" };

export default async function RequestDetailPage({ params, searchParams }: PageProps<"/dashboard/requests/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  await requireUser(`/dashboard/requests/${id}`);
  const supabase = await createClient();

  // RLS guarantees only the owner (or the admin) can read these rows.
  const { data: request } = await supabase
    .from("consultation_requests")
    .select("*, category:consultation_categories(title, intake_questions)")
    .eq("id", id)
    .maybeSingle<ConsultationRequest & { category: { title: string; intake_questions: IntakeQuestion[] } | null }>();
  if (!request) notFound();

  const [{ data: history }, { data: messages }, { data: files }, { data: appointments }, { data: outcomes }] =
    await Promise.all([
      supabase.from("request_status_history").select("*").eq("request_id", id).order("created_at"),
      supabase.from("request_messages").select("*").eq("request_id", id).order("created_at"),
      supabase.from("files").select("*").eq("request_id", id).eq("purpose", "request_attachment").order("created_at"),
      supabase.from("appointments").select("*").eq("request_id", id).order("starts_at", { ascending: false }),
      supabase.from("consultation_outcomes").select("id, title, status, published_at").eq("request_id", id),
    ]);

  const status = requestStatusMeta[request.status];
  const activeAppointment = (appointments as Appointment[] | null)?.find((a) =>
    ACTIVE_APPOINTMENT_STATUSES.includes(a.status),
  );
  const canMessage = !["declined", "completed"].includes(request.status);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={request.reference_code}
        title={request.category?.title ?? "Consultation request"}
        description={`Submitted ${formatDateTime(request.submitted_at)}`}
        actions={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      />

      {sp.submitted ? (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Request submitted</AlertTitle>
          <AlertDescription>
            Your reference is {request.reference_code}. You&apos;ll receive an email when the status changes.
          </AlertDescription>
        </Alert>
      ) : null}
      {sp.uploadWarning ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Some attachments could not be uploaded</AlertTitle>
          <AlertDescription>Your request was saved. You can send the files by replying below.</AlertDescription>
        </Alert>
      ) : null}

      <Section title="Current status">
        <p className="text-sm">{status.description}</p>
        {request.client_message ? (
          <div className="mt-3 rounded-lg border-l-4 border-teal bg-accent/40 p-4 text-sm">
            <p className="font-medium">Message from the consultant</p>
            <p className="mt-1 whitespace-pre-wrap">{request.client_message}</p>
          </div>
        ) : null}
        {request.status === "accepted" && !activeAppointment ? (
          <Button asChild className="mt-4">
            <Link href={`/dashboard/appointments/book?request=${request.id}`}>
              <CalendarPlus data-icon="inline-start" /> Book your appointment
            </Link>
          </Button>
        ) : null}
        {activeAppointment ? (
          <p className="mt-4 text-sm">
            Appointment: <strong>{formatDateTime(activeAppointment.starts_at, activeAppointment.timezone)}</strong> ·{" "}
            {appointmentStatusMeta[activeAppointment.status].label} ·{" "}
            <Link href="/dashboard/appointments" className="text-teal underline">
              Manage
            </Link>
          </p>
        ) : null}
        {(outcomes as Pick<ConsultationOutcome, "id" | "title" | "status">[] | null)?.length ? (
          <ul className="mt-4 space-y-1 text-sm">
            {(outcomes as Pick<ConsultationOutcome, "id" | "title" | "status">[]).map((o) => (
              <li key={o.id}>
                Outcome: {o.title} — {outcomeStatusMeta[o.status].clientLabel}{" "}
                {o.status === "published" ? (
                  <Link href={`/dashboard/outcomes/${o.id}`} className="text-teal underline">
                    View
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <ol className="mt-6 border-l pl-5 text-sm">
          {((history ?? []) as RequestStatusHistory[]).map((h) => (
            <li key={h.id} className="relative pb-3 last:pb-0">
              <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-teal ring-4 ring-card" aria-hidden />
              <span className="font-medium">{requestStatusMeta[h.to_status].label}</span>
              <span className="text-muted-foreground"> · {formatDateTime(h.created_at)}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Messages" description="Use this thread for clarifications about your request.">
        <MessageThread messages={(messages ?? []) as RequestMessage[]} viewer="client" />
        {canMessage ? (
          <div className="mt-5 border-t pt-5">
            <MessageForm
              requestId={request.id}
              action={postClientMessage}
              label={request.status === "more_info_required" ? "Reply with the requested information" : "Send a message"}
            />
          </div>
        ) : null}
      </Section>

      <Section title="Your submission">
        <DefinitionList
          items={[
            { label: "Name", value: request.full_name },
            { label: "Email", value: request.email },
            { label: "Phone", value: request.phone },
            { label: "Current status", value: request.education_status },
            { label: "College or organisation", value: request.organization },
            { label: "Course or specialisation", value: request.course },
            { label: "Preferred format", value: formatLabel(request.preferred_format) },
            { label: "Preferred date", value: request.preferred_date ? formatDate(request.preferred_date) : null },
          ]}
        />
        <div className="mt-6 grid gap-4">
          {[
            ["Challenge", request.challenge],
            ["Career goals", request.goals],
            ["Current concerns", request.concerns],
            ["Questions", request.questions],
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
        {(files as FileRecord[] | null)?.length ? (
          <div className="mt-6">
            <p className="text-xs text-muted-foreground">Attachments</p>
            <ul className="mt-2 grid gap-2">
              {(files as FileRecord[]).map((f) => (
                <li key={f.id}>
                  <a href={`/api/files/${f.id}`} className="inline-flex items-center gap-2 text-sm text-teal hover:underline">
                    <FileText className="size-4" aria-hidden /> {f.original_name}{" "}
                    <span className="text-muted-foreground">({formatBytes(f.size_bytes)})</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-6 text-xs text-muted-foreground">
          AI-assisted preparation: {request.consent_ai ? "allowed" : "not allowed"}.
        </p>
      </Section>
    </div>
  );
}
