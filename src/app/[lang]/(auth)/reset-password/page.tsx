import type { Metadata } from "next";
import { languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { ResetPasswordForm } from "../forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t, href } = await getI18n();
  return {
    title: t.auth.reset.metaTitle,
    alternates: { ...languageAlternates("/reset-password"), canonical: href("/reset-password") },
  };
}

export default async function ResetPasswordPage() {
  const { t: dict } = await getI18n();
  const t = dict.auth.reset;
  return (
    <>
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t.intro}</p>
      <ResetPasswordForm />
    </>
  );
}
