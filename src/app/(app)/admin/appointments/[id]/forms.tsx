"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { initialActionState } from "@/lib/action-result";
import type { SlotDayGroup } from "@/lib/booking/display";
import { FormMessage, SubmitButton, TextAreaField } from "@/components/shared/form";
import { SlotPicker } from "@/components/booking/slot-picker";
import { confirmAppointment, rescheduleAppointment } from "../actions";

export function ConfirmForm({
  appointmentId,
  meetingDetails,
  mode,
}: {
  appointmentId: string;
  meetingDetails: string | null;
  mode: "confirm" | "update";
}) {
  const [state, formAction] = useActionState(confirmAppointment, initialActionState);
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);
  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <TextAreaField
        name="meetingDetails"
        label="Meeting details (optional)"
        rows={3}
        maxLength={1000}
        defaultValue={meetingDetails}
        placeholder="e.g. Video link: https://meet.example.com/abc-defg"
        state={state}
      />
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Saving…">{mode === "confirm" ? "Confirm appointment" : "Save details"}</SubmitButton>
      </div>
    </form>
  );
}

export function RescheduleForm({
  appointmentId,
  groups,
  timezoneLabel,
  meetingDetails,
}: {
  appointmentId: string;
  groups: SlotDayGroup[];
  timezoneLabel: string;
  meetingDetails: string | null;
}) {
  const [state, formAction] = useActionState(rescheduleAppointment, initialActionState);
  const router = useRouter();
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.data?.refresh) router.refresh();
  }, [state, router]);
  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <SlotPicker key={groups.map((g) => g.slots.length).join("-")} groups={groups} timezoneLabel={timezoneLabel} error={state.fieldErrors?.startsAt?.[0]} />
      {meetingDetails ? (
        <p className="text-sm text-muted-foreground">
          Current meeting details are kept: <span className="whitespace-pre-wrap text-foreground">{meetingDetails}</span>
        </p>
      ) : null}
      <TextAreaField name="message" label="Message to the client (optional)" rows={2} maxLength={1000} state={state} />
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Rescheduling…">Reschedule and confirm</SubmitButton>
      </div>
    </form>
  );
}
