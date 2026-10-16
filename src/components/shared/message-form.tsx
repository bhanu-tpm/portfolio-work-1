"use client";

import { useActionState, useEffect, useRef } from "react";
import { initialActionState, type ActionState } from "@/lib/action-result";
import { FormMessage, SubmitButton, TextAreaField } from "@/components/shared/form";

export function MessageForm({
  requestId,
  action,
  label = "Reply",
  placeholder,
}: {
  requestId: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label?: string;
  placeholder?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={formAction} className="grid gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <TextAreaField name="body" label={label} rows={3} required state={state} placeholder={placeholder} maxLength={4000} />
      {!state.ok ? <FormMessage state={state} /> : null}
      <div>
        <SubmitButton pendingLabel="Sending…">Send</SubmitButton>
      </div>
    </form>
  );
}
