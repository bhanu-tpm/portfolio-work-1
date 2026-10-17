"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/action-result";
import { CheckboxField, FormMessage, SubmitButton, TextField } from "@/components/shared/form";
import { useI18n } from "@/i18n/provider";
import { translateState } from "@/i18n/translate-message";
import { requestPasswordReset, signIn, signUp, updatePassword } from "./actions";

function NextField() {
  const next = useSearchParams().get("next");
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

/** Server Actions can't read the [lang] root param, so each form posts its locale. */
function LocaleField() {
  const { locale } = useI18n();
  return <input type="hidden" name="locale" value={locale} />;
}

/** useActionState with messages and field errors translated for the current locale. */
function useLocalizedActionState(action: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
  const { locale } = useI18n();
  const [state, formAction] = useActionState(action, initialActionState);
  return [translateState(locale, state), formAction] as const;
}

export function SignInForm() {
  const { t: dict, href } = useI18n();
  const t = dict.auth.form;
  const [state, action] = useLocalizedActionState(signIn);
  const params = useSearchParams();
  return (
    <form action={action} className="grid gap-4" noValidate>
      <LocaleField />
      {params.get("error") ? <FormMessage state={{ ok: false, message: t.invalidLink }} /> : null}
      <FormMessage state={state} />
      <NextField />
      <TextField name="email" label={t.email} type="email" autoComplete="email" required state={state} />
      <div className="grid gap-1.5">
        <TextField name="password" label={t.password} type="password" autoComplete="current-password" required state={state} />
        <Link href={href("/forgot-password")} className="justify-self-end text-xs text-teal hover:underline">
          {t.forgot}
        </Link>
      </div>
      <SubmitButton pendingLabel={t.signingIn} className="h-10">
        {t.signIn}
      </SubmitButton>
    </form>
  );
}

function Sent({ message }: { message?: string }) {
  const { t } = useI18n();
  return (
    <div role="status" className="flex flex-col items-center py-4 text-center">
      <MailCheck className="size-10 text-teal" aria-hidden />
      <p className="mt-3 font-medium">{t.auth.form.checkEmail}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function SignUpForm() {
  const { t: dict, href } = useI18n();
  const t = dict.auth.form;
  const [state, action] = useLocalizedActionState(signUp);
  if (state.ok) return <Sent message={state.message} />;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <LocaleField />
      <FormMessage state={state} />
      <NextField />
      <TextField name="fullName" label={t.fullName} autoComplete="name" required state={state} maxLength={120} />
      <TextField name="email" label={t.email} type="email" autoComplete="email" required state={state} />
      <TextField
        name="password"
        label={t.password}
        type="password"
        autoComplete="new-password"
        required
        state={state}
        description={t.passwordHint}
      />
      <CheckboxField
        name="acceptTerms"
        required
        state={state}
        label={
          <>
            {t.acceptBefore}
            <Link href={href("/privacy")} className="text-teal underline" target="_blank">
              {t.privacyLink}
            </Link>
            {t.andThe}
            <Link href={href("/disclaimer")} className="text-teal underline" target="_blank">
              {t.disclaimerLink}
            </Link>
            {t.acceptAfter}
          </>
        }
      />
      <SubmitButton pendingLabel={t.creatingAccount} className="h-10">
        {t.createAccount}
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { t: dict } = useI18n();
  const t = dict.auth.form;
  const [state, action] = useLocalizedActionState(requestPasswordReset);
  if (state.ok) return <Sent message={state.message} />;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <LocaleField />
      <FormMessage state={state} />
      <TextField name="email" label={t.email} type="email" autoComplete="email" required state={state} />
      <SubmitButton pendingLabel={t.sending} className="h-10">
        {t.sendReset}
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const { t: dict } = useI18n();
  const t = dict.auth.form;
  const [state, action] = useLocalizedActionState(updatePassword);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <LocaleField />
      <FormMessage state={state} />
      <TextField
        name="password"
        label={t.newPassword}
        type="password"
        autoComplete="new-password"
        required
        state={state}
        description={t.passwordHint}
      />
      <TextField name="confirm" label={t.confirmPassword} type="password" autoComplete="new-password" required state={state} />
      <SubmitButton pendingLabel={t.updating} className="h-10">
        {t.updatePassword}
      </SubmitButton>
    </form>
  );
}
