"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-result";
import {
  CheckboxField,
  FormMessage,
  NativeSelectField,
  SubmitButton,
  TextField,
} from "@/components/shared/form";
import { updateProfile } from "./actions";

export function ProfileForm({
  defaults,
  educationStatuses,
}: {
  defaults: {
    fullName: string;
    phone: string;
    educationStatus: string;
    organization: string;
    course: string;
    emailNotifications: boolean;
    aiConsent: boolean;
  };
  educationStatuses: readonly string[];
}) {
  const [state, formAction] = useActionState(updateProfile, initialActionState);
  const statusOptions = [
    { value: "", label: "Prefer not to say" },
    ...educationStatuses.map((s) => ({ value: s, label: s })),
    ...(defaults.educationStatus && !educationStatuses.includes(defaults.educationStatus)
      ? [{ value: defaults.educationStatus, label: defaults.educationStatus }]
      : []),
  ];

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="fullName" label="Name" required autoComplete="name" maxLength={120} defaultValue={defaults.fullName} state={state} />
        <TextField name="phone" label="Phone (optional)" type="tel" autoComplete="tel" maxLength={30} defaultValue={defaults.phone} state={state} />
        <NativeSelectField name="educationStatus" label="Current status" options={statusOptions} defaultValue={defaults.educationStatus} state={state} />
        <TextField name="organization" label="School, college or organisation (optional)" maxLength={160} defaultValue={defaults.organization} state={state} />
        <TextField name="course" label="Course or specialisation (optional)" maxLength={160} defaultValue={defaults.course} state={state} className="sm:col-span-2" />
      </div>
      <CheckboxField
        name="emailNotifications"
        label="Email me about my requests, appointments and outcomes"
        defaultChecked={defaults.emailNotifications}
        state={state}
      />
      <CheckboxField
        name="aiConsent"
        label="Allow optional AI features (career guidance assistant)"
        description="Unticking withdraws consent: the AI assistant stops working until you agree again. It does not delete past conversations — use the button below for that."
        defaultChecked={defaults.aiConsent}
        state={state}
      />
      <FormMessage state={state} />
      <div>
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </form>
  );
}
