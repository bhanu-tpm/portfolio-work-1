"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { BadgeCheck, ExternalLink, Loader2, Plus, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initialActionState, type ActionState } from "@/lib/action-result";
import { OUTCOME_SECTIONS, type OutcomeContent } from "@/lib/db/types";
import type { VerifiedResource } from "@/lib/ai/schemas";
import { Markdown } from "@/components/shared/markdown";
import { AiLabel } from "@/components/shared/page";
import { FormMessage, SubmitButton } from "@/components/shared/form";
import { generateOutcomeDraft, saveOutcomeVersion, suggestOutcomeResources } from "../actions";

interface Note {
  id: string;
  body: string;
}

export function OutcomeEditor({
  outcomeId,
  initialContent,
  latestVersion,
  latestSource,
  editable,
  aiEnabled,
  consentAi,
  hasPreparation,
  notes,
}: {
  outcomeId: string;
  initialContent: OutcomeContent;
  latestVersion: number;
  latestSource: string;
  editable: boolean;
  aiEnabled: boolean;
  consentAi: boolean;
  hasPreparation: boolean;
  notes: Note[];
}) {
  const [content, setContent] = useState<OutcomeContent>(initialContent);
  const [aiTouched, setAiTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  // The parent keys this component by version id, so state resets when a new version arrives.
  const [saveState, saveAction] = useActionState(saveOutcomeVersion, initialActionState);

  useEffect(() => {
    if (saveState.ok && saveState.message) toast.success(saveState.message);
  }, [saveState]);

  const update = (key: keyof OutcomeContent, value: string, fromAi = false) => {
    setContent((c) => ({ ...c, [key]: value }));
    setDirty(true);
    if (fromAi) setAiTouched(true);
  };

  return (
    <div className="grid gap-6">
      {latestSource === "ai_draft" && !dirty ? (
        <div className="flex items-start gap-2 rounded-lg bg-accent/60 p-3 text-sm">
          <AiLabel className="shrink-0" />
          <p>The latest version is an unreviewed AI draft. Edit it into your own words before approving.</p>
        </div>
      ) : null}

      <form action={saveAction} className="grid gap-5">
        <input type="hidden" name="outcomeId" value={outcomeId} />
        <input type="hidden" name="content" value={JSON.stringify(content)} />
        <input type="hidden" name="aiAssisted" value={String(aiTouched || latestSource === "ai_draft")} />
        <FormMessage state={saveState.ok ? { ok: false } : saveState} />
        {OUTCOME_SECTIONS.map((section) => (
          <SectionField
            key={section.key}
            outcomeId={outcomeId}
            sectionKey={section.key}
            title={section.title}
            value={content[section.key]}
            editable={editable}
            aiEnabled={aiEnabled}
            consentAi={consentAi}
            currentDraft={content}
            onChange={(v, fromAi) => update(section.key, v, fromAi)}
          />
        ))}
        {editable ? (
          <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center">
            <Input name="changeNote" placeholder="What changed? (optional)" maxLength={500} className="sm:max-w-sm" aria-label="Change note" />
            <SubmitButton pendingLabel="Saving…" disabled={!dirty}>
              Save as version {latestVersion + 1}
            </SubmitButton>
            {dirty ? <span className="text-xs text-warning">Unsaved changes</span> : null}
          </div>
        ) : null}
      </form>

      {editable && aiEnabled ? (
        <AiDraftPanel
          outcomeId={outcomeId}
          notes={notes}
          consentAi={consentAi}
          hasPreparation={hasPreparation}
          currentDraft={content}
        />
      ) : null}
      {editable && aiEnabled ? (
        <ResourcePanel
          outcomeId={outcomeId}
          onInsert={(md) => update("skillsAndResources", `${content.skillsAndResources.trim()}\n${md}`.trim(), true)}
        />
      ) : null}
    </div>
  );
}

function SectionField({
  outcomeId,
  sectionKey,
  title,
  value,
  editable,
  aiEnabled,
  consentAi,
  currentDraft,
  onChange,
}: {
  outcomeId: string;
  sectionKey: keyof OutcomeContent;
  title: string;
  value: string;
  editable: boolean;
  aiEnabled: boolean;
  consentAi: boolean;
  currentDraft: OutcomeContent;
  onChange: (value: string, fromAi?: boolean) => void;
}) {
  const [instructions, setInstructions] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [pending, startTransition] = useTransition();
  const id = `section-${sectionKey}`;

  const regenerate = () =>
    startTransition(async () => {
      const fd = new FormData();
      fd.set("outcomeId", outcomeId);
      fd.set("section", sectionKey);
      fd.set("sectionInstructions", instructions);
      fd.set("currentDraft", JSON.stringify(currentDraft));
      fd.set("includeCurrentDraft", "on");
      if (consentAi) fd.set("includeRequirements", "on");
      const result: ActionState = await generateOutcomeDraft(initialActionState, fd);
      if (result.ok && typeof result.data?.content === "string") {
        onChange(result.data.content, true);
        toast.success("Section regenerated — review it before saving.");
      } else {
        toast.error(result.message ?? "Could not regenerate this section.");
      }
    });

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-semibold">
          {title}
        </Label>
        {editable && aiEnabled ? (
          <Button type="button" variant="ghost" size="xs" onClick={() => setShowAi((s) => !s)} aria-expanded={showAi}>
            <Wand2 /> Regenerate
          </Button>
        ) : null}
      </div>
      {showAi ? (
        <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3 sm:flex-row">
          <Input
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Optional instruction, e.g. 'make it more concise'"
            aria-label={`Instruction for regenerating ${title}`}
            maxLength={2000}
          />
          <Button type="button" size="sm" onClick={regenerate} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {pending ? "Working…" : "Regenerate section"}
          </Button>
        </div>
      ) : null}
      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            readOnly={!editable}
            rows={5}
            maxLength={12000}
            placeholder="Markdown supported: short paragraphs and bullet lists."
          />
        </TabsContent>
        <TabsContent value="preview">
          <div className="min-h-24 rounded-lg border p-3">
            {value.trim() ? <Markdown className="text-sm">{value}</Markdown> : <p className="text-sm text-muted-foreground">Empty</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AiDraftPanel({
  outcomeId,
  notes,
  consentAi,
  hasPreparation,
  currentDraft,
}: {
  outcomeId: string;
  notes: Note[];
  consentAi: boolean;
  hasPreparation: boolean;
  currentDraft: OutcomeContent;
}) {
  const [state, action, pending] = useActionState(generateOutcomeDraft, initialActionState);
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);
  return (
    <section className="rounded-xl border border-dashed border-teal/40 bg-accent/20 p-4 sm:p-6" aria-labelledby="ai-draft-heading">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="ai-draft-heading" className="font-sans text-base font-semibold tracking-normal">
          Generate a full AI draft
        </h2>
        <AiLabel />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose exactly what the AI may see. The draft is saved as a new, unapproved version. Names and contact details are removed before sending.
      </p>
      <form action={action} className="mt-4 grid gap-4">
        <input type="hidden" name="outcomeId" value={outcomeId} />
        <input type="hidden" name="currentDraft" value={JSON.stringify(currentDraft)} />
        <FormMessage state={state.ok ? { ok: false } : state} />
        <fieldset className="grid gap-2 text-sm">
          <legend className="mb-1 font-medium">Sources</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="includeRequirements" defaultChecked={consentAi} disabled={!consentAi} className="size-4 accent-[var(--primary)]" />
            Client&apos;s original requirements {consentAi ? "" : "(client did not consent to AI)"}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="includePreparation" defaultChecked={consentAi && hasPreparation} disabled={!consentAi || !hasPreparation} className="size-4 accent-[var(--primary)]" />
            AI preparation summary {hasPreparation ? "" : "(none available)"}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="includeCurrentDraft" className="size-4 accent-[var(--primary)]" />
            Current editor content
          </label>
          {notes.length ? (
            <div className="mt-2 grid gap-1.5">
              <p className="text-xs text-muted-foreground">Private notes (unticked by default)</p>
              {notes.map((n) => (
                <label key={n.id} className="flex items-start gap-2">
                  <input type="checkbox" name="noteIds" value={n.id} className="mt-0.5 size-4 accent-[var(--primary)]" />
                  <span className="line-clamp-2">{n.body}</span>
                </label>
              ))}
            </div>
          ) : null}
        </fieldset>
        <div className="grid gap-1.5">
          <Label htmlFor="sessionNotes">Session notes</Label>
          <Textarea id="sessionNotes" name="sessionNotes" rows={5} maxLength={20000} placeholder="What was discussed in the consultation?" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="recommendations">Recommendations and resources you selected</Label>
          <Textarea id="recommendations" name="recommendations" rows={3} maxLength={10000} />
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? "Drafting…" : "Generate draft"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ResourcePanel({ outcomeId, onInsert }: { outcomeId: string; onInsert: (markdown: string) => void }) {
  const [state, action, pending] = useActionState(suggestOutcomeResources, initialActionState);
  const result = state.ok ? (state.data as { items: VerifiedResource[]; caveats: string[] } | undefined) : undefined;
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6" aria-labelledby="resources-heading">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="resources-heading" className="font-sans text-base font-semibold tracking-normal">
          Resource suggestions
        </h2>
        <AiLabel />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Links are shown only when they come from cited search results. Everything else is an unverified idea to check yourself.
      </p>
      <form action={action} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="outcomeId" value={outcomeId} />
        <Input name="focus" placeholder="e.g. beginner data analysis skills, free options" aria-label="What resources are needed?" maxLength={500} required />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Suggest
        </Button>
      </form>
      {!state.ok && state.message ? <p className="mt-2 text-sm text-destructive">{state.message}</p> : null}
      {result ? (
        <div className="mt-4 grid gap-3">
          {result.items.map((r, i) => (
            <div key={i} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{r.title}</p>
                <span className={r.verification === "cited_source" ? "inline-flex items-center gap-1 text-xs text-success" : "text-xs text-warning"}>
                  {r.verification === "cited_source" ? (
                    <>
                      <BadgeCheck className="size-3.5" aria-hidden /> Cited source
                    </>
                  ) : (
                    "Unverified suggestion"
                  )}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">{r.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">Why: {r.whyRelevant}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-teal underline">
                    Open source <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onInsert(`- **${r.title}** — ${r.description}${r.url ? ` ([link](${r.url}))` : ""}`)}
                >
                  <Plus /> Insert into Skills and resources
                </Button>
              </div>
            </div>
          ))}
          {result.caveats.length ? (
            <ul className="list-disc pl-5 text-xs text-muted-foreground">
              {result.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
