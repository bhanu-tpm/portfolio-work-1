"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { cn } from "cn";
import { initialActionState } from "@/lib/action-result";
import type { ConsultationCategory } from "@/lib/db/types";
import { formatLabel } from "@/lib/format";
import { EDUCATION_STATUSES } from "@/lib/validation/schemas";
import { Label } from "@/components/ui/label";
import {
  CheckboxField,
  FormMessage,
  NativeSelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/shared/form";
import { submitConsultationRequest } from "../actions";

interface Defaults {
  fullName: string;
  email: string;
  phone: string;
  educationStatus: string;
  organization: string;
  course: string;
}

function Fieldset({ legend, description, children }: { legend: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
      <div>
        <legend className="font-medium">{legend}</legend>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

export function RequestForm({
  categories,
  defaults,
  initialCategoryId,
  minDate,
}: {
  categories: ConsultationCategory[];
  defaults: Defaults;
  initialCategoryId?: string;
  minDate: string;
}) {
  const [state, action] = useActionState(submitConsultationRequest, initialActionState);
  const [categoryId, setCategoryId] = useState(
    state.values?.categoryId ?? (categories.some((c) => c.id === initialCategoryId) ? initialCategoryId : "") ?? "",
  );
  const category = useMemo(() => categories.find((c) => c.id === categoryId), [categories, categoryId]);
  const categoryError = state.fieldErrors?.categoryId?.[0];

  return (
    <form action={action} className="grid gap-6" noValidate>
      <FormMessage state={state} />

      <Fieldset legend="1. What would you like help with?">
        <div role="radiogroup" aria-label="Consultation category" aria-describedby={categoryError ? "category-error" : undefined} className="grid gap-3 sm:grid-cols-2">
          {categories.map((c) => (
            <label
              key={c.id}
              className={cn(
                "flex cursor-pointer flex-col rounded-lg p-4 ring-1 ring-border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                categoryId === c.id ? "bg-accent ring-2 ring-teal" : "hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="categoryId"
                value={c.id}
                checked={categoryId === c.id}
                onChange={() => setCategoryId(c.id)}
                className="sr-only"
              />
              <span className="text-sm font-medium">{c.title}</span>
              <span className="mt-1 text-xs text-muted-foreground">{c.short_description}</span>
            </label>
          ))}
        </div>
        {categoryError ? (
          <p id="category-error" className="text-xs font-medium text-destructive">
            {categoryError}
          </p>
        ) : null}
      </Fieldset>

      <Fieldset legend="2. About you" description="Contact details are only used to manage your consultation.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="fullName" label="Full name" required state={state} defaultValue={defaults.fullName} autoComplete="name" maxLength={120} />
          <TextField name="email" label="Email" type="email" required state={state} defaultValue={defaults.email} autoComplete="email" />
          <TextField name="phone" label="Phone (optional)" type="tel" state={state} defaultValue={defaults.phone} autoComplete="tel" />
          <NativeSelectField
            name="educationStatus"
            label="Current status"
            required
            state={state}
            defaultValue={defaults.educationStatus}
            placeholder="Select…"
            options={EDUCATION_STATUSES.map((s) => ({ value: s, label: s }))}
          />
          <TextField name="organization" label="College or organisation" state={state} defaultValue={defaults.organization} maxLength={160} />
          <TextField name="course" label="Course, degree or specialisation" state={state} defaultValue={defaults.course} maxLength={160} />
        </div>
      </Fieldset>

      <Fieldset legend="3. Your situation" description="The more specific you are, the more useful the consultation will be.">
        <TextAreaField name="challenge" label="Describe the challenge or decision you're facing" required rows={5} state={state} maxLength={4000} description="At least 20 characters." />
        <TextAreaField name="goals" label="Your career goals" required state={state} maxLength={3000} />
        <TextAreaField name="concerns" label="Current concerns (optional)" state={state} maxLength={3000} />
        <TextAreaField name="questions" label="Questions you'd like answered" required state={state} maxLength={3000} />
        <TextAreaField name="expectedOutcomes" label="What would a successful consultation give you?" required state={state} maxLength={3000} />
        {category?.intake_questions.map((q) =>
          q.type === "textarea" ? (
            <TextAreaField key={q.id} name={`answer_${q.id}`} label={q.label} required={q.required} state={state} maxLength={2000} />
          ) : (
            <TextField key={q.id} name={`answer_${q.id}`} label={q.label} required={q.required} state={state} maxLength={2000} />
          ),
        )}
      </Fieldset>

      <Fieldset legend="4. Preferences">
        <div className="grid gap-5 sm:grid-cols-2">
          <NativeSelectField
            name="preferredFormat"
            label="Preferred format"
            required
            state={state}
            placeholder={category ? "Select…" : "Choose a category first"}
            options={(category?.formats ?? []).map((f) => ({ value: f, label: formatLabel(f) }))}
            defaultValue=""
          />
          <TextField name="preferredDate" label="Preferred date (optional)" type="date" state={state} min={minDate} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="attachments">Relevant attachments (optional)</Label>
          <input
            id="attachments"
            name="attachments"
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg"
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            aria-describedby="attachments-help"
          />
          <p id="attachments-help" className="text-xs text-muted-foreground">
            Up to 3 files (PDF, PNG, JPEG or DOCX), 4 MB in total — for example a resume or transcript.
          </p>
        </div>
      </Fieldset>

      <Fieldset legend="5. Privacy and consent">
        <CheckboxField
          name="consentPrivacy"
          required
          state={state}
          label={
            <>
              I agree that my information is stored and used to prepare and deliver my consultation, as described in the{" "}
              <Link href="/privacy" target="_blank" className="text-teal underline">
                privacy notice
              </Link>
              .
            </>
          }
        />
        <CheckboxField
          name="consentAi"
          state={state}
          defaultChecked
          label="Allow AI-assisted preparation (optional)"
          description="An AI tool may summarise your request privately for the consultant. Names and contact details are removed first. All decisions are made by the consultant, and you can say no without affecting your consultation."
        />
      </Fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <SubmitButton pendingLabel="Submitting…" className="h-10 px-5">
          Submit request
        </SubmitButton>
      </div>
    </form>
  );
}
