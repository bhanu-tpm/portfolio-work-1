"use client";

import * as React from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { initialActionState, type ActionState } from "@/lib/action-result";
import { SubmitButton } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Shows a toast whenever a new action result with a message arrives. */
export function useActionToast(state: ActionState, onSuccess?: () => void) {
  const last = useRef<ActionState | null>(null);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });
  useEffect(() => {
    if (state === last.current || state === initialActionState) return;
    last.current = state;
    if (state.message) {
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
    if (state.ok) onSuccessRef.current?.();
  }, [state]);
}

function HiddenFields({ fields }: { fields: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

/** A one-click action (toggle, move, mark handled) rendered as a tiny form; results show as toasts. */
export function InlineActionForm({
  action,
  fields,
  children,
  label,
  variant = "outline",
  size = "sm",
  pendingLabel,
  disabled,
  className,
}: {
  action: FormAction;
  fields: Record<string, string>;
  children: React.ReactNode;
  /** Accessible label when children is icon-only. */
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  pendingLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useActionToast(state);
  return (
    <form action={formAction} className={className}>
      <HiddenFields fields={fields} />
      <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel ?? "…"} disabled={disabled}>
        {label ? <span className="sr-only">{label}</span> : null}
        {children}
      </SubmitButton>
    </form>
  );
}

/** Destructive action behind an AlertDialog confirmation. */
export function ConfirmActionForm({
  action,
  fields,
  triggerLabel,
  title,
  description,
  confirmLabel = "Delete",
  triggerVariant = "destructive",
  triggerSize = "sm",
  triggerIcon,
}: {
  action: FormAction;
  fields: Record<string, string>;
  triggerLabel: string;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  triggerIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, initialActionState);
  useActionToast(state, () => setOpen(false));
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size={triggerSize}>
          {triggerIcon}
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction} className="grid gap-4">
          <HiddenFields fields={fields} />
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {!state.ok && state.message ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.message}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <SubmitButton variant="destructive" pendingLabel="Working…">
              {confirmLabel}
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
