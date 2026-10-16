import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Lightbulb, ListChecks, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, href } = await getI18n();
  return {
    title: t.assistantPage.meta.title,
    description: t.assistantPage.meta.description,
    alternates: { ...languageAlternates("/assistant"), canonical: href("/assistant") },
  };
}

/** Icons for the points in t.assistantPage.points, in order. */
const ICONS = [Compass, Lightbulb, ListChecks, ShieldCheck];

export default async function AssistantPreviewPage() {
  const { t: dict } = await getI18n();
  const t = dict.assistantPage;
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-teal">{t.badge}</p>
        <h1 className="mt-2 text-4xl font-semibold text-primary">{t.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{t.intro}</p>
      </div>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        {t.points.map((p, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <li key={p.title} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <Icon className="size-5 text-teal" aria-hidden />
              <h2 className="mt-3 font-sans text-base font-semibold tracking-normal">{p.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
            </li>
          );
        })}
      </ul>
      <div className="mt-10 rounded-xl border-l-4 border-warning bg-warning/5 p-5 text-sm">
        <p className="font-medium">{t.noteTitle}</p>
        <p className="mt-1 text-muted-foreground">{t.noteBody}</p>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="h-11 px-5">
          <Link href="/dashboard/assistant">{t.start}</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-11 px-5">
          <Link href="/dashboard/requests/new">{t.book}</Link>
        </Button>
      </div>
    </div>
  );
}
