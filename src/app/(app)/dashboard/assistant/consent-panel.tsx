"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { initialActionState } from "@/lib/action-result";
import { FormMessage, SubmitButton } from "@/components/shared/form";
import { Section } from "@/components/shared/page";
import { giveAiConsent } from "./actions";

export function ConsentPanel({ retentionDays }: { retentionDays: number }) {
  const [state, formAction] = useActionState(() => giveAiConsent(), initialActionState);

  return (
    <Section title="Before you start" description="Please read how the AI assistant works and how your data is handled.">
      <ul className="mb-5 grid gap-3 text-sm">
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
          <span>
            <strong>Exploratory, not definitive.</strong> The assistant offers ideas and questions for reflection. It
            can be wrong, and it does not decide what career is right for you.
          </span>
        </li>
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
          <span>
            <strong>Data minimisation.</strong> Your messages are sent to an AI provider to generate replies. Email
            addresses, phone numbers, links and your name are removed first. Please don&apos;t share sensitive
            personal details you don&apos;t need to.
          </span>
        </li>
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
          <span>
            <strong>Retention.</strong> Your conversation is stored in your account so you can continue it, and is
            deleted automatically after {retentionDays} days of inactivity.
          </span>
        </li>
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
          <span>
            <strong>You stay in control.</strong> You can clear your history or withdraw consent at any time in{" "}
            <Link href="/dashboard/settings" className="underline underline-offset-4">
              Profile and privacy
            </Link>
            . Nothing is shared with the consultant unless you choose to.
          </span>
        </li>
      </ul>
      <form action={formAction} className="grid gap-3">
        <FormMessage state={state} />
        <div>
          <SubmitButton pendingLabel="Saving…">I understand — start using the assistant</SubmitButton>
        </div>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">
        Prefer to talk to a person?{" "}
        <Link href="/dashboard/requests/new" className="underline underline-offset-4">
          Book a human consultation
        </Link>
        .
      </p>
    </Section>
  );
}
