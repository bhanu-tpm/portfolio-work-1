"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initialActionState } from "@/lib/action-result";
import type { SlotDayGroup } from "@/lib/booking/display";
import { FormMessage, NativeSelectField, SubmitButton, TextAreaField } from "@/components/shared/form";
import { SlotPicker } from "@/components/booking/slot-picker";
import { bookAppointment } from "../actions";

export function BookingForm({
  requestId,
  groups,
  timezoneLabel,
  formats,
}: {
  requestId: string;
  groups: SlotDayGroup[];
  timezoneLabel: string;
  formats: { value: string; label: string }[];
}) {
  const [state, formAction] = useActionState(bookAppointment, initialActionState);
  const router = useRouter();

  // When a slot was taken by someone else, reload availability from the server.
  useEffect(() => {
    if (!state.ok && state.data?.refresh) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="requestId" value={requestId} />
      <SlotPicker key={groups.map((g) => g.slots.length).join("-")} groups={groups} timezoneLabel={timezoneLabel} error={state.fieldErrors?.startsAt?.[0]} />
      <NativeSelectField
        name="format"
        label="Format"
        required
        options={formats}
        defaultValue={formats[0]?.value}
        state={state}
        className="max-w-xs"
      />
      <TextAreaField
        name="clientNote"
        label="Note for the consultant (optional)"
        rows={3}
        maxLength={1000}
        placeholder="Anything you'd like to share before the session."
        state={state}
      />
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Booking…">Request this time</SubmitButton>
      </div>
    </form>
  );
}
