import type { Metadata } from "next";
import Link from "next/link";
import { languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { ForgotPasswordForm } from "../forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t, href } = await getI18n();
  return {
    title: t.auth.forgot.metaTitle,
    alternates: { ...languageAlternates("/forgot-password"), canonical: href("/forgot-password") },
  };
}

export default async function ForgotPasswordPage() {
  const { t: dict, href } = await getI18n();
  const t = dict.auth.forgot;
  return (
    <>
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t.intro}</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href={href("/login")} className="font-medium text-teal hover:underline">
          {t.back}
        </Link>
      </p>
    </>
  );
}
