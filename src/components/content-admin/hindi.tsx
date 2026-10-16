"use client";

import * as React from "react";
import { cn } from "cn";
import type { ActionState } from "@/lib/action-result";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HINDI_HINT } from "./hindi-text";


/** "हिंदी (Hindi)" with the Devanagari part marked as Hindi for screen readers. */
export function HindiLabel({ suffix }: { suffix?: string }) {
  return (
    <>
      <span lang="hi">हिंदी</span> (Hindi){suffix}
    </>
  );
}

/** Heading + hint shown at the top of a Hindi area. */
export function HindiNote({ className }: { className?: string }) {
  return (
    <p className={cn("rounded-lg bg-accent/60 px-3 py-2 text-xs text-accent-foreground", className)}>
      <span className="font-medium">
        <HindiLabel suffix=" — optional." />
      </span>{" "}
      {HINDI_HINT}
    </p>
  );
}

function hasErrors(state: ActionState | undefined, fields: readonly string[]) {
  return fields.some((f) => Boolean(state?.fieldErrors?.[f]?.length));
}

/**
 * English | हिंदी switcher for one form section. Both panels stay mounted (hidden when
 * inactive) so every input is submitted. After a failed save it jumps to the language
 * whose fields have errors, and marks the tab.
 */
export function LanguageTabs({
  english,
  hindi,
  state,
  englishFields = [],
  hindiFields = [],
  hindiFilled,
  label = "Language",
  className,
}: {
  english: React.ReactNode;
  hindi: React.ReactNode;
  state?: ActionState;
  englishFields?: readonly string[];
  hindiFields?: readonly string[];
  /** Shows a ✓ on the Hindi tab when some Hindi text is present. */
  hindiFilled?: boolean;
  label?: string;
  className?: string;
}) {
  const enInvalid = hasErrors(state, englishFields);
  const hiInvalid = hasErrors(state, hindiFields);
  const [tab, setTab] = React.useState<"en" | "hi">("en");
  const [seenState, setSeenState] = React.useState(state);
  if (seenState !== state) {
    // Adjust the active tab when a new action result arrives (render-time state update).
    setSeenState(state);
    if (enInvalid) setTab("en");
    else if (hiInvalid) setTab("hi");
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v === "hi" ? "hi" : "en")} className={cn("gap-4", className)}>
      <TabsList aria-label={label}>
        <TabsTrigger value="en" className="px-3">
          English
          {enInvalid ? <ErrorDot /> : null}
        </TabsTrigger>
        <TabsTrigger value="hi" className="px-3">
          <HindiLabel />
          {hiInvalid ? (
            <ErrorDot />
          ) : hindiFilled ? (
            <span className="text-success" aria-label="has Hindi text">
              ✓
            </span>
          ) : null}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="en" forceMount className="grid gap-5 data-[state=inactive]:hidden">
        {english}
      </TabsContent>
      <TabsContent value="hi" forceMount className="grid gap-5 data-[state=inactive]:hidden">
        <HindiNote />
        {hindi}
      </TabsContent>
    </Tabs>
  );
}

function ErrorDot() {
  return (
    <>
      <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
      <span className="sr-only">(has errors)</span>
    </>
  );
}
