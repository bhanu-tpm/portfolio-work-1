"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-result";
import { FormMessage, NativeSelectField, SubmitButton, TextField } from "@/components/shared/form";
import { createOutcome } from "../actions";

export function NewOutcomeForm({
  requestId,
  defaultTitle,
  appointments,
}: {
  requestId: string;
  defaultTitle: string;
  appointments: { value: string; label: string }[];
}) {
  const [state, action] = useActionState(createOutcome, initialActionState);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="requestId" value={requestId} />
      <FormMessage state={state} />
      <TextField name="title" label="Title" required state={state} defaultValue={defaultTitle} maxLength={200} />
      <NativeSelectField
        name="appointmentId"
        label="Linked appointment"
        state={state}
        defaultValue=""
        options={[{ value: "", label: "None" }, ...appointments]}
      />
      <div>
        <SubmitButton pendingLabel="Creating…">Create and open editor</SubmitButton>
      </div>
    </form>
  );
}
