import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { SignInForm } from "../forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t, href } = await getI18n();
  return { title: t.auth.login.metaTitle, alternates: { ...languageAlternates("/login"), canonical: href("/login") } };
}

export default async function LoginPage() {
  const { t: dict, href } = await getI18n();
  const t = dict.auth.login;
  return (
    <>
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t.intro}</p>
      <Suspense>
        <SignInForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t.newHere}{" "}
        <Link href={href("/signup")} className="font-medium text-teal hover:underline">
          {t.createAccount}
        </Link>
      </p>
    </>
  );
}
