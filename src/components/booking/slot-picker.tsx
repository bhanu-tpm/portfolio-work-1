"use client";

import { useId, useState } from "react";
import { cn } from "cn";
import type { SlotDayGroup } from "@/lib/booking/display";

/**
 * Mobile-friendly slot picker: a horizontally scrollable day list, then the
 * times for the chosen day. Submits the selected slot as a hidden `name` input.
 */
export function SlotPicker({
  groups,
  name = "startsAt",
  timezoneLabel,
  error,
}: {
  groups: SlotDayGroup[];
  name?: string;
  timezoneLabel: string;
  error?: string;
}) {
  const [day, setDay] = useState(groups[0]?.key ?? "");
  const [selected, setSelected] = useState("");
  const baseId = useId();
  const current = groups.find((g) => g.key === day) ?? groups[0];
  const selectedLabel = (() => {
    for (const g of groups) {
      const s = g.slots.find((x) => x.startsAt === selected);
      if (s) return `${g.label}, ${s.label}`;
    }
    return null;
  })();

  if (!current) return null;

  return (
    <fieldset className="grid gap-3" aria-describedby={error ? `${baseId}-error` : `${baseId}-tz`}>
      <legend className="mb-1 text-sm font-medium">
        Choose a time <span className="font-normal text-muted-foreground">({timezoneLabel})</span>
      </legend>
      <p id={`${baseId}-tz`} className="sr-only">
        Times are shown in {timezoneLabel}.
      </p>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Day">
        {groups.map((g) => {
          const active = g.key === current.key;
          const hasSelection = g.slots.some((s) => s.startsAt === selected);
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setDay(g.key)}
              aria-pressed={active}
              className={cn(
                "flex min-w-20 shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              <span className="font-medium whitespace-nowrap">{g.label}</span>
              <span className={cn("text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {g.slots.length} {g.slots.length === 1 ? "slot" : "slots"}
                {hasSelection ? " ✓" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div role="radiogroup" aria-label={`Times on ${current.label}`} className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {current.slots.map((s) => {
          const id = `${baseId}-${s.startsAt}`;
          const checked = selected === s.startsAt;
          return (
            <label
              key={s.startsAt}
              htmlFor={id}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                checked ? "border-teal bg-teal text-white" : "bg-card hover:bg-muted",
              )}
            >
              <input
                id={id}
                type="radio"
                name={`${name}-choice`}
                value={s.startsAt}
                checked={checked}
                onChange={() => setSelected(s.startsAt)}
                className="sr-only"
              />
              {s.label}
            </label>
          );
        })}
      </div>

      <input type="hidden" name={name} value={selected} />
      <p className="text-sm" aria-live="polite">
        {selectedLabel ? (
          <>
            Selected: <strong>{selectedLabel}</strong> ({timezoneLabel})
          </>
        ) : (
          <span className="text-muted-foreground">No time selected yet.</span>
        )}
      </p>
      {error ? (
        <p id={`${baseId}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
