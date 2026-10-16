"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { initialActionState } from "@/lib/action-result";
import { FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/shared/form";
import { useI18n } from "@/i18n/provider";
import { translateState } from "@/i18n/translate-message";
import { submitContact } from "./actions";

export function ContactForm() {
  const { locale, t: dict, href } = useI18n();
  const t = dict.contact.form;
  const [rawState, action] = useActionState(submitContact, initialActionState);
  const state = translateState(locale, rawState);
  const startedAt = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startedAt.current) startedAt.current.value = String(Date.now());
  }, []);

  if (state.ok) {
    return (
      <div role="status" className="flex flex-col items-center rounded-xl bg-card p-10 text-center ring-1 ring-foreground/10">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <p className="mt-4 text-lg font-medium">{t.sentTitle}</p>
        <p className="mt-1 text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5 rounded-xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label={t.name} autoComplete="name" required state={state} maxLength={120} />
        <TextField name="email" label={t.email} type="email" autoComplete="email" required state={state} />
      </div>
      <TextField name="subject" label={t.subject} required state={state} maxLength={160} />
      <TextAreaField name="message" label={t.message} required rows={6} state={state} maxLength={5000} />
      {/* Spam protection: hidden honeypot + time-to-submit check */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input ref={startedAt} type="hidden" name="startedAt" defaultValue="0" />
      <p className="text-xs text-muted-foreground">
        {t.privacyBefore}
        <Link href={href("/privacy")} className="underline">
          {t.privacyLink}
        </Link>
        {t.privacyAfter}
      </p>
      <div>
        <SubmitButton pendingLabel={t.sending}>{t.send}</SubmitButton>
      </div>
    </form>
  );
}
