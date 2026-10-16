"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ActionState } from "@/lib/action-result";

export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant,
  size,
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className={className}
      variant={variant}
      size={size}
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      name={name}
      value={value}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingLabel ?? "Saving…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

interface FieldProps {
  name: string;
  label: string;
  state?: ActionState;
  description?: React.ReactNode;
  required?: boolean;
  className?: string;
}

function FieldShell({
  name,
  label,
  state,
  description,
  required,
  className,
  children,
}: FieldProps & { children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode }) {
  const errors = state?.fieldErrors?.[name];
  const id = `field-${name}`;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </Label>
      {children({
        id,
        describedBy: [descriptionId, errorId].filter(Boolean).join(" ") || undefined,
        invalid: Boolean(errors?.length),
      })}
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  type = "text",
  defaultValue,
  placeholder,
  autoComplete,
  maxLength,
  lang,
  ...props
}: FieldProps & {
  lang?: string;
  type?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  min?: string;
  max?: string;
}) {
  const value = props.state?.values?.[props.name] ?? defaultValue ?? "";
  return (
    <FieldShell {...props}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          name={props.name}
          type={type}
          defaultValue={type === "password" ? undefined : String(value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={props.required}
          maxLength={maxLength}
          min={props.min}
          max={props.max}
          lang={lang}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    </FieldShell>
  );
}

export function TextAreaField({
  defaultValue,
  placeholder,
  rows = 4,
  maxLength,
  lang,
  ...props
}: FieldProps & { defaultValue?: string | null; placeholder?: string; rows?: number; maxLength?: number; lang?: string }) {
  const value = props.state?.values?.[props.name] ?? defaultValue ?? "";
  return (
    <FieldShell {...props}>
      {({ id, describedBy, invalid }) => (
        <Textarea
          id={id}
          name={props.name}
          defaultValue={value}
          placeholder={placeholder}
          rows={rows}
          required={props.required}
          maxLength={maxLength}
          lang={lang}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    </FieldShell>
  );
}

export function NativeSelectField({
  options,
  defaultValue,
  placeholder,
  ...props
}: FieldProps & {
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  placeholder?: string;
}) {
  const value = props.state?.values?.[props.name] ?? defaultValue ?? "";
  return (
    <FieldShell {...props}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          name={props.name}
          defaultValue={value}
          required={props.required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  description,
  defaultChecked,
  state,
  required,
}: {
  name: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  defaultChecked?: boolean;
  state?: ActionState;
  required?: boolean;
}) {
  const errors = state?.fieldErrors?.[name];
  const id = `field-${name}`;
  const echoed = state?.values ? state.values[name] === "on" : undefined;
  return (
    <div className="grid gap-1">
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={echoed ?? defaultChecked}
          required={required}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={errors?.length ? `${id}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 rounded border-input accent-[var(--primary)]"
        />
        <label htmlFor={id} className="text-sm leading-snug">
          {label}
          {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
        </label>
      </div>
      {errors?.length ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <Alert variant={state.ok ? "default" : "destructive"} role={state.ok ? "status" : "alert"} aria-live="polite">
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
