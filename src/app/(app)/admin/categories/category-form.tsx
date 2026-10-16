"use client";

import { useActionState, useId, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { initialActionState } from "@/lib/action-result";
import type { ConsultationCategory, IntakeQuestion } from "@/lib/db/types";
import { formatLabel, slugify } from "@/lib/format";
import { KNOWN_FORMATS, moveInOrder, questionIdFromLabel } from "@/lib/validation/content";
import { CheckboxField, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/content-admin/action-forms";
import { HindiLabel, LanguageTabs } from "@/components/content-admin/hindi";
import { HINDI_HINT } from "@/components/content-admin/hindi-text";
import { saveCategory } from "./actions";

type Row = IntakeQuestion & { key: string; idTouched: boolean };
let counter = 0;
const newKey = () => `q${++counter}`;

function parseEcho<T>(raw: string | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function CategoryForm({ category }: { category?: ConsultationCategory }) {
  const [state, action] = useActionState(saveCategory, initialActionState);
  useActionToast(state);
  const uid = useId();
  const v = state.values;

  const [title, setTitle] = useState(v?.title ?? category?.title ?? "");
  const [slug, setSlug] = useState(v?.slug ?? category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [formats, setFormats] = useState<string[]>(category?.formats ?? ["video", "phone"]);
  const [questions, setQuestions] = useState<Row[]>(() =>
    (parseEcho<IntakeQuestion[]>(v?.intakeQuestions) ?? category?.intake_questions ?? []).map((q) => ({
      ...q,
      key: newKey(),
      idTouched: true,
    })),
  );

  const errors = state.fieldErrors ?? {};
  const unknownFormats = formats.filter((f) => !(KNOWN_FORMATS as readonly string[]).includes(f));
  const questionsJson = JSON.stringify(
    questions.map(({ id, label, label_hi, type, required }) => ({
      id: id.trim(),
      label: label.trim(),
      ...(label_hi?.trim() ? { label_hi: label_hi.trim() } : {}),
      type,
      required,
    })),
  );
  const update = (key: string, patch: Partial<Row>) =>
    setQuestions((all) => all.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  return (
    <form action={action} className="grid gap-6" noValidate>
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <input type="hidden" name="intakeQuestions" value={questionsJson} />
      <FormMessage state={state} />

      <section className="grid gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <LanguageTabs
          label="Category text language"
          state={state}
          englishFields={["title", "slug", "shortDescription", "scope"]}
          hindiFields={["titleHi", "shortDescriptionHi", "scopeHi"]}
          hindiFilled={Boolean(category?.title_hi || category?.short_description_hi || category?.scope_hi)}
          english={
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="field-title">
                    Title<span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="field-title"
                    name="title"
                    value={title}
                    maxLength={120}
                    required
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!slugTouched) setSlug(slugify(e.target.value));
                    }}
                    aria-invalid={errors.title ? true : undefined}
                    aria-describedby={errors.title ? "field-title-error" : undefined}
                  />
                  {errors.title ? (
                    <p id="field-title-error" className="text-xs font-medium text-destructive">
                      {errors.title[0]}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="field-slug">
                    Slug<span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="field-slug"
                    name="slug"
                    value={slug}
                    maxLength={80}
                    required
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                    }}
                    aria-invalid={errors.slug ? true : undefined}
                    aria-describedby={errors.slug ? "field-slug-error" : undefined}
                  />
                  {errors.slug ? (
                    <p id="field-slug-error" className="text-xs font-medium text-destructive">
                      {errors.slug[0]}
                    </p>
                  ) : null}
                </div>
              </div>
              <TextAreaField
                name="shortDescription"
                label="Short description"
                required
                rows={2}
                maxLength={400}
                state={state}
                defaultValue={category?.short_description}
                description="Shown on the services page and when choosing a category."
              />
              <TextAreaField
                name="scope"
                label="Scope (what's included)"
                rows={5}
                maxLength={2000}
                state={state}
                defaultValue={category?.scope}
              />
            </>
          }
          hindi={
            <>
              <TextField
                name="titleHi"
                label="Title (Hindi)"
                lang="hi"
                maxLength={120}
                state={state}
                defaultValue={category?.title_hi}
              />
              <TextAreaField
                name="shortDescriptionHi"
                label="Short description (Hindi)"
                lang="hi"
                rows={2}
                maxLength={400}
                state={state}
                defaultValue={category?.short_description_hi}
              />
              <TextAreaField
                name="scopeHi"
                label="Scope (Hindi)"
                lang="hi"
                rows={5}
                maxLength={2000}
                state={state}
                defaultValue={category?.scope_hi}
              />
            </>
          }
        />
      </section>

      <section className="grid gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <fieldset className="grid gap-2" aria-describedby={errors.formats ? "formats-error" : undefined}>
          <legend className="mb-1 text-sm font-medium">
            Formats<span className="text-destructive" aria-hidden>*</span>
          </legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {[...KNOWN_FORMATS, ...unknownFormats].map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="formats"
                  value={f}
                  checked={formats.includes(f)}
                  onChange={(e) =>
                    setFormats((all) => (e.target.checked ? [...all, f] : all.filter((x) => x !== f)))
                  }
                  className="size-4 rounded border-input accent-[var(--primary)]"
                />
                {formatLabel(f)}
              </label>
            ))}
          </div>
          {errors.formats ? (
            <p id="formats-error" className="text-xs font-medium text-destructive">
              {errors.formats[0]}
            </p>
          ) : null}
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="durationMinutes"
            label="Duration (minutes)"
            type="number"
            min="15"
            max="240"
            state={state}
            defaultValue={category?.duration_minutes ?? 60}
            description="15–240. Leave empty to use the default booking length."
          />
        </div>
        <CheckboxField
          name="resumeReviewEnabled"
          label="Resume review"
          description="Clients in this category can attach a resume for review."
          state={state}
          defaultChecked={category?.resume_review_enabled ?? false}
        />
        <CheckboxField
          name="isActive"
          label="Active"
          description="Inactive categories are hidden from the public site and the request form."
          state={state}
          defaultChecked={category?.is_active ?? true}
        />
      </section>

      <section className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6" aria-labelledby={`${uid}-q-title`}>
        <div>
          <h2 id={`${uid}-q-title`} className="font-sans text-base font-semibold tracking-normal">
            Intake questions
          </h2>
          <p className="text-sm text-muted-foreground">
            Extra questions asked when a client chooses this category (up to 15). Changing an id makes earlier answers appear
            under the old id.
          </p>
          <p className="text-xs text-muted-foreground">
            Hindi labels are optional. {HINDI_HINT}
          </p>
        </div>
        {questions.length === 0 ? <p className="text-sm text-muted-foreground">No extra questions.</p> : null}
        <ol className="grid gap-3">
          {questions.map((q, i) => (
            <li key={q.key} className="grid gap-3 rounded-lg p-3 ring-1 ring-border">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Question {i + 1}</span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === 0}
                    onClick={() => setQuestions((all) => reorder(all, q.key, "up"))}
                  >
                    <ArrowUp aria-hidden />
                    <span className="sr-only">Move question {i + 1} up</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === questions.length - 1}
                    onClick={() => setQuestions((all) => reorder(all, q.key, "down"))}
                  >
                    <ArrowDown aria-hidden />
                    <span className="sr-only">Move question {i + 1} down</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setQuestions((all) => all.filter((x) => x.key !== q.key))}
                  >
                    <Trash2 aria-hidden />
                    <span className="sr-only">Remove question {i + 1}</span>
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor={`${uid}-label-${i}`} className="text-xs">
                    Label
                  </Label>
                  <Input
                    id={`${uid}-label-${i}`}
                    value={q.label}
                    maxLength={300}
                    onChange={(e) =>
                      update(q.key, {
                        label: e.target.value,
                        ...(q.idTouched ? {} : { id: questionIdFromLabel(e.target.value) }),
                      })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${uid}-label-hi-${i}`} className="text-xs">
                    Label — <HindiLabel suffix=", optional" />
                  </Label>
                  <Input
                    id={`${uid}-label-hi-${i}`}
                    lang="hi"
                    value={q.label_hi ?? ""}
                    maxLength={300}
                    placeholder="Blank = English label"
                    onChange={(e) => update(q.key, { label_hi: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                <div className="grid gap-1">
                  <Label htmlFor={`${uid}-id-${i}`} className="text-xs">
                    Id
                  </Label>
                  <Input
                    id={`${uid}-id-${i}`}
                    value={q.id}
                    maxLength={40}
                    className="font-mono"
                    onChange={(e) => update(q.key, { id: e.target.value, idTouched: true })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`${uid}-type-${i}`} className="text-xs">
                    Answer type
                  </Label>
                  <select
                    id={`${uid}-type-${i}`}
                    value={q.type}
                    onChange={(e) => update(q.key, { type: e.target.value === "textarea" ? "textarea" : "text" })}
                    className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="text">Short text</option>
                    <option value="textarea">Long text</option>
                  </select>
                </div>
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => update(q.key, { required: e.target.checked })}
                    className="size-4 rounded border-input accent-[var(--primary)]"
                  />
                  Required
                </label>
              </div>
            </li>
          ))}
        </ol>
        {errors.intakeQuestions ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.intakeQuestions[0]?.startsWith("Question id")
              ? errors.intakeQuestions[0]
              : "Check the questions: each needs a label (3+ characters) and an id using lowercase letters, numbers and underscores."}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={questions.length >= 15}
          onClick={() =>
            setQuestions((all) => [...all, { key: newKey(), id: "", label: "", type: "text", required: false, idTouched: false }])
          }
        >
          <Plus aria-hidden /> Add question
        </Button>
      </section>

      <div className="flex justify-end">
        <SubmitButton className="h-10 px-5">{category ? "Save category" : "Create category"}</SubmitButton>
      </div>
    </form>
  );
}

function reorder(rows: Row[], key: string, direction: "up" | "down") {
  const order = moveInOrder(
    rows.map((r) => r.key),
    key,
    direction,
  );
  if (!order) return rows;
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return order.map((k) => byKey.get(k)!);
}
