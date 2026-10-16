"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { initialActionState } from "@/lib/action-result";
import { RESUME_TEXT_MAX } from "@/lib/validation/student-ai";
import { Label } from "@/components/ui/label";
import {
  CheckboxField,
  FormMessage,
  NativeSelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/shared/form";
import { submitResumeReview } from "./actions";

export function ResumeForm({
  requests,
  maxUploadMb,
  dailyLimit,
}: {
  requests: { id: string; label: string }[];
  maxUploadMb: number;
  dailyLimit: number;
}) {
  const [state, formAction] = useActionState(submitResumeReview, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<"pdf" | "text">("pdf");

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const fileError = state.fieldErrors?.resumeFile?.[0];

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">How would you like to share your resume?</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="pdf"
              checked={mode === "pdf"}
              onChange={() => setMode("pdf")}
              className="accent-[var(--primary)]"
            />
            Upload a PDF
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="text"
              checked={mode === "text"}
              onChange={() => setMode("text")}
              className="accent-[var(--primary)]"
            />
            Paste the text
          </label>
        </div>
      </fieldset>

      {mode === "pdf" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="field-resumeFile">Resume (PDF)</Label>
          <input
            id="field-resumeFile"
            name="resumeFile"
            type="file"
            accept="application/pdf,.pdf"
            required
            aria-invalid={fileError ? true : undefined}
            aria-describedby={`resumeFile-hint${fileError ? " resumeFile-error" : ""}`}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <p id="resumeFile-hint" className="text-xs text-muted-foreground">
            Text-based PDF, up to {maxUploadMb} MB. Scanned images can&apos;t be read — paste the text instead.
          </p>
          {fileError ? (
            <p id="resumeFile-error" className="text-xs font-medium text-destructive">
              {fileError}
            </p>
          ) : null}
        </div>
      ) : (
        <TextAreaField
          name="pastedText"
          label="Resume text"
          rows={10}
          required
          maxLength={RESUME_TEXT_MAX}
          state={state}
          description={`Up to ${RESUME_TEXT_MAX.toLocaleString("en-IN")} characters. The text is used only to generate feedback and is not stored.`}
        />
      )}

      <TextField
        name="targetRole"
        label="Target role (optional)"
        placeholder="e.g. Junior data analyst"
        maxLength={160}
        state={state}
      />

      {requests.length > 0 ? (
        <NativeSelectField
          name="requestId"
          label="Link to a consultation request (optional)"
          options={[{ value: "none", label: "Don't link" }, ...requests.map((r) => ({ value: r.id, label: r.label }))]}
          defaultValue="none"
          state={state}
          description="Linking connects this review to your request so the consultant can use it when preparing your session."
        />
      ) : null}

      <CheckboxField
        name="consentProcessing"
        required
        state={state}
        label="I agree that my resume is processed by an AI service to generate feedback."
        description="Email addresses, phone numbers, links and your name are removed before the text is sent. An uploaded PDF and the feedback are stored privately in your account (visible to you and the consultant) until you delete them."
      />

      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Reviewing your resume…">Get feedback</SubmitButton>
        <p className="text-xs text-muted-foreground">Up to {dailyLimit} reviews per day. This can take up to a minute.</p>
      </div>
    </form>
  );
}
