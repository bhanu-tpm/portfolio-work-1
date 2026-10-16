import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { SignUpForm } from "../forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t, href } = await getI18n();
  return { title: t.auth.signup.metaTitle, alternates: { ...languageAlternates("/signup"), canonical: href("/signup") } };
}

export default async function SignUpPage() {
  const { t: dict, href } = await getI18n();
  const t = dict.auth.signup;
  return (
    <>
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t.intro}</p>
      <Suspense>
        <SignUpForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t.haveAccount}{" "}
        <Link href={href("/login")} className="font-medium text-teal hover:underline">
          {t.signIn}
        </Link>
      </p>
    </>
  );
}
