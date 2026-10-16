"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/shared/form";
import { initialActionState, type ActionState } from "@/lib/action-result";

export interface DialogField {
  name: string;
  label: string;
  type?: "text" | "textarea";
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | null;
  description?: string;
  maxLength?: number;
}

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];

/**
 * Confirmation dialog wrapping a server action form. Used for destructive or
 * state-changing actions (cancel, delete, mark no-show...). Optional fields
 * (e.g. a reason) are rendered inside the dialog.
 */
export function ActionDialog({
  action,
  hidden,
  fields = [],
  triggerLabel,
  triggerVariant = "outline",
  title,
  description,
  confirmLabel,
  confirmVariant = "default",
  pendingLabel = "Working…",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  fields?: DialogField[];
  triggerLabel: string;
  triggerVariant?: ButtonVariant;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  pendingLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.ok) {
      setOpen(false);
      if (result.message) toast.success(result.message);
    }
    return result;
  }, initialActionState);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size="sm">
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {fields.map((f) =>
            f.type === "text" ? (
              <TextField
                key={f.name}
                name={f.name}
                label={f.label}
                required={f.required}
                placeholder={f.placeholder}
                defaultValue={f.defaultValue}
                description={f.description}
                maxLength={f.maxLength}
                state={state}
              />
            ) : (
              <TextAreaField
                key={f.name}
                name={f.name}
                label={f.label}
                required={f.required}
                placeholder={f.placeholder}
                defaultValue={f.defaultValue}
                description={f.description}
                maxLength={f.maxLength ?? 1000}
                rows={3}
                state={state}
              />
            ),
          )}
          {!state.ok ? <FormMessage state={state} /> : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Keep as is</AlertDialogCancel>
            <SubmitButton variant={confirmVariant} pendingLabel={pendingLabel}>
              {confirmLabel}
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
