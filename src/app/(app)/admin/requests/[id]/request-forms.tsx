"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/action-result";
import type { RequestStatus } from "@/lib/db/types";
import { requestStatusMeta } from "@/lib/format";
import type { IntakeAnalysis } from "@/lib/ai/schemas";
import { FormMessage, NativeSelectField, SubmitButton, TextAreaField } from "@/components/shared/form";
import { addAdminNote, runIntakeAnalysis, saveAnalysisEdits, updateRequestStatus } from "../actions";

export function StatusForm({ requestId, allowed }: { requestId: string; allowed: RequestStatus[] }) {
  const [state, action] = useActionState(updateRequestStatus, initialActionState);
  if (!allowed.length) return <p className="text-sm text-muted-foreground">No further status changes are available.</p>;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="requestId" value={requestId} />
      <FormMessage state={state} />
      <NativeSelectField
        name="status"
        label="New status"
        required
        state={state}
        placeholder="Select…"
        defaultValue=""
        options={allowed.map((s) => ({ value: s, label: requestStatusMeta[s].label }))}
      />
      <TextAreaField
        name="clientMessage"
        label="Message to the client"
        state={state}
        rows={3}
        maxLength={3000}
        description="Visible to the client and included in the email. Required when asking for more information or declining."
      />
      <div>
        <SubmitButton pendingLabel="Updating…">Update status</SubmitButton>
      </div>
    </form>
  );
}

export function NoteForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(addAdminNote, initialActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <TextAreaField name="body" label="Add a private note" rows={3} required state={state} maxLength={10000} />
      {!state.ok ? <FormMessage state={state} /> : null}
      <div>
        <SubmitButton size="sm" pendingLabel="Saving…">
          Save note
        </SubmitButton>
      </div>
    </form>
  );
}

export function GenerateAnalysisButton({ requestId, hasExisting }: { requestId: string; hasExisting: boolean }) {
  const [state, action, pending] = useActionState(runIntakeAnalysis, initialActionState);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <Button type="submit" variant={hasExisting ? "outline" : "default"} size="sm" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : hasExisting ? <RefreshCw /> : <Sparkles />}
        {pending ? "Analysing…" : hasExisting ? "Regenerate" : "Generate AI analysis"}
      </Button>
      {state.message && !pending ? (
        <p role="status" className={state.ok ? "text-xs text-success" : "text-xs text-destructive"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

const LIST_FIELDS: { key: Exclude<keyof IntakeAnalysis, "situationSummary" | "educationCareerContext">; label: string }[] = [
  { key: "mainChallenges", label: "Main challenges" },
  { key: "statedGoals", label: "Stated goals" },
  { key: "keyQuestions", label: "Key questions to address" },
  { key: "missingInformation", label: "Missing information" },
  { key: "followUpQuestions", label: "Suggested follow-up questions" },
  { key: "potentialTopics", label: "Potential consultation topics" },
  { key: "preparationChecklist", label: "Preparation checklist" },
  { key: "assumptionsToAvoid", label: "Assumptions to avoid" },
];

export function AnalysisView({ analysis }: { analysis: IntakeAnalysis }) {
  return (
    <div className="grid gap-5 text-sm">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Situation summary</p>
        <p className="mt-1 whitespace-pre-wrap">{analysis.situationSummary}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Education and career context</p>
        <p className="mt-1 whitespace-pre-wrap">{analysis.educationCareerContext}</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {LIST_FIELDS.map(({ key, label }) =>
          analysis[key].length ? (
            <div key={key}>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {analysis[key].map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

export function AnalysisEditor({
  generationId,
  requestId,
  analysis,
}: {
  generationId: string;
  requestId: string;
  analysis: IntakeAnalysis;
}) {
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(analysis.situationSummary);
  const [context, setContext] = useState(analysis.educationCareerContext);
  // Lists are edited as raw multi-line text and split only when serialising.
  const [lists, setLists] = useState(
    () => Object.fromEntries(LIST_FIELDS.map(({ key }) => [key, analysis[key].join("\n")])) as Record<string, string>,
  );
  const [state, action] = useActionState(saveAnalysisEdits, initialActionState);

  // After a successful save the page refreshes and remounts this editor (keyed by updated_at).
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  if (!editing) {
    return (
      <div className="grid gap-4">
        <AnalysisView analysis={analysis} />
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
        </div>
      </div>
    );
  }

  const fromLines = (v: string) =>
    v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  const serialized: IntakeAnalysis = {
    situationSummary: summary,
    educationCareerContext: context,
    ...(Object.fromEntries(LIST_FIELDS.map(({ key }) => [key, fromLines(lists[key] ?? "")])) as Pick<
      IntakeAnalysis,
      (typeof LIST_FIELDS)[number]["key"]
    >),
  };

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="generationId" value={generationId} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="content" value={JSON.stringify(serialized)} />
      <FormMessage state={state} />
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Situation summary</span>
        <textarea
          className="min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-2"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Education and career context</span>
        <textarea
          className="min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-2"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        {LIST_FIELDS.map(({ key, label }) => (
          <label key={key} className="grid gap-1.5 text-sm">
            <span className="font-medium">
              {label} <span className="font-normal text-muted-foreground">(one per line)</span>
            </span>
            <textarea
              className="min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-2"
              value={lists[key] ?? ""}
              onChange={(e) => setLists({ ...lists, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <SubmitButton size="sm">Save edits</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
