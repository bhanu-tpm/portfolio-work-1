"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { initialActionState, type ActionState } from "@/lib/action-result";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage, SubmitButton, TextField } from "@/components/shared/form";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function useToastOnSuccess(state: ActionState, onSuccess?: () => void) {
  const callback = useRef(onSuccess);
  useEffect(() => {
    callback.current = onSuccess;
  });
  useEffect(() => {
    if (state.ok) {
      if (state.message) toast.success(state.message);
      callback.current?.();
    }
  }, [state]);
}

/**
 * Field with a per-form unique id. Several rule/period forms are rendered on the
 * same page, so the shared helpers' fixed `field-<name>` ids would collide.
 */
function LocalField({
  prefix,
  name,
  label,
  state,
  description,
  children,
}: {
  prefix: string;
  name: string;
  label: string;
  state: ActionState;
  description?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = `${prefix}-${name}`;
  const error = state.fieldErrors?.[name]?.[0];
  const describedBy = [description ? `${id}-desc` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {description ? (
        <p id={`${id}-desc`} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RuleForm({
  action,
  rule,
}: {
  action: Action;
  rule?: { id: string; weekday: number; start_time: string; end_time: string; is_active: boolean };
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const prefix = useId();
  useToastOnSuccess(state, () => {
    if (!rule) formRef.current?.reset();
  });
  const v = state.ok ? undefined : state.values;
  return (
    <form ref={formRef} action={formAction} className="grid gap-3" aria-label={rule ? "Edit hours" : "Add hours"}>
      {rule ? <input type="hidden" name="id" value={rule.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-3 sm:items-start">
        <LocalField prefix={prefix} name="weekday" label="Day" state={state}>
          {(p) => (
            <select
              {...p}
              name="weekday"
              defaultValue={v?.weekday ?? String(rule?.weekday ?? 1)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {WEEKDAY_ORDER.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAYS[d]}
                </option>
              ))}
            </select>
          )}
        </LocalField>
        <LocalField prefix={prefix} name="startTime" label="Start" state={state}>
          {(p) => <Input {...p} type="time" name="startTime" required defaultValue={v?.startTime ?? rule?.start_time.slice(0, 5) ?? "10:00"} />}
        </LocalField>
        <LocalField prefix={prefix} name="endTime" label="End" state={state}>
          {(p) => <Input {...p} type="time" name="endTime" required defaultValue={v?.endTime ?? rule?.end_time.slice(0, 5) ?? "17:00"} />}
        </LocalField>
      </div>
      <div className="flex items-center gap-2.5">
        <input
          id={`${prefix}-isActive`}
          type="checkbox"
          name="isActive"
          defaultChecked={v ? v.isActive === "on" : (rule?.is_active ?? true)}
          className="size-4 rounded border-input accent-[var(--primary)]"
        />
        <label htmlFor={`${prefix}-isActive`} className="text-sm">
          Active
        </label>
      </div>
      {!state.ok ? <FormMessage state={state} /> : null}
      <div>
        <SubmitButton size="sm" pendingLabel="Saving…">
          {rule ? "Save" : "Add hours"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function BlockedPeriodForm({
  action,
  period,
  timezoneLabel,
}: {
  action: Action;
  period?: { id: string; startsAt: string; endsAt: string; reason: string | null };
  timezoneLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const prefix = useId();
  useToastOnSuccess(state, () => {
    if (!period) formRef.current?.reset();
  });
  const v = state.ok ? undefined : state.values;
  return (
    <form ref={formRef} action={formAction} className="grid gap-3" aria-label={period ? "Edit blocked period" : "Add blocked period"}>
      {period ? <input type="hidden" name="id" value={period.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <LocalField prefix={prefix} name="startsAt" label="Start" description={`In ${timezoneLabel}`} state={state}>
          {(p) => <Input {...p} type="datetime-local" name="startsAt" required defaultValue={v?.startsAt ?? period?.startsAt} />}
        </LocalField>
        <LocalField prefix={prefix} name="endsAt" label="End" description={`In ${timezoneLabel}`} state={state}>
          {(p) => <Input {...p} type="datetime-local" name="endsAt" required defaultValue={v?.endsAt ?? period?.endsAt} />}
        </LocalField>
      </div>
      <LocalField prefix={prefix} name="reason" label="Reason (optional, internal)" state={state}>
        {(p) => <Input {...p} name="reason" maxLength={200} defaultValue={v?.reason ?? period?.reason ?? ""} />}
      </LocalField>
      <FormMessage state={state} />
      <div>
        <SubmitButton size="sm" pendingLabel="Saving…">
          {period ? "Save" : "Block time"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function BookingSettingsForm({
  action,
  settings,
}: {
  action: Action;
  settings: {
    timezone: string;
    slotMinutes: number;
    bufferMinutes: number;
    minNoticeHours: number;
    maxDaysAhead: number;
    formats: string[];
    reminderHoursBefore: number;
  };
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useToastOnSuccess(state);
  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="timezone"
          label="Timezone"
          required
          defaultValue={settings.timezone}
          description="IANA name, e.g. Asia/Kolkata or Europe/London."
          state={state}
        />
        <TextField
          name="formats"
          label="Formats"
          required
          defaultValue={settings.formats.join(", ")}
          description="Comma separated: video, phone, in_person, chat. Clients see formats offered by both the category and this list."
          state={state}
        />
        <TextField name="slotMinutes" label="Default slot length (minutes)" type="number" min="15" max="240" required defaultValue={settings.slotMinutes} description="Categories with their own duration override this." state={state} />
        <TextField name="bufferMinutes" label="Buffer after each appointment (minutes)" type="number" min="0" max="120" required defaultValue={settings.bufferMinutes} state={state} />
        <TextField name="minNoticeHours" label="Minimum notice (hours)" type="number" min="0" max="336" required defaultValue={settings.minNoticeHours} state={state} />
        <TextField name="maxDaysAhead" label="Book up to (days ahead)" type="number" min="1" max="180" required defaultValue={settings.maxDaysAhead} state={state} />
        <TextField name="reminderHoursBefore" label="Reminder (hours before)" type="number" min="1" max="72" required defaultValue={settings.reminderHoursBefore} state={state} />
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Saving…">Save booking settings</SubmitButton>
      </div>
    </form>
  );
}
