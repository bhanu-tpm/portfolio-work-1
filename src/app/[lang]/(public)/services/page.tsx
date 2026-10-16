import type { Metadata } from "next";
import Link from "next/link";
import { Clock, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getActiveCategories } from "@/lib/content";
import { formatLabel } from "@/lib/format";
import { localizeCategory } from "@/lib/localize";
import { EmptyState } from "@/components/shared/page";
import { fmt, languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, href } = await getI18n();
  return {
    title: t.services.meta.title,
    description: t.services.meta.description,
    alternates: { ...languageAlternates("/services"), canonical: href("/services") },
  };
}

export default async function ServicesPage() {
  const { locale, t: dict } = await getI18n();
  const t = dict.services;
  const categories = (await getActiveCategories()).map((c) => localizeCategory(c, locale));
  const formatName = (f: string) => dict.common.formats[f] ?? formatLabel(f);
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold text-primary">{t.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t.intro}</p>
      </div>

      {categories.length === 0 ? (
        <EmptyState className="mt-10" title={t.emptyTitle} description={t.emptyBody} />
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {categories.map((c) => (
            <article key={c.id} id={c.slug} className="flex scroll-mt-24 flex-col rounded-xl bg-card p-6 ring-1 ring-foreground/10">
              <h2 className="font-sans text-xl font-semibold tracking-normal">{c.title}</h2>
              <p className="mt-2 text-muted-foreground">{c.short_description}</p>
              {c.scope ? (
                <div className="mt-4">
                  <h3 className="font-sans text-sm font-semibold tracking-normal">{t.included}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{c.scope}</p>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MonitorSmartphone className="size-4" aria-hidden />
                  {c.formats.map(formatName).join(dict.common.or)}
                </span>
                {c.duration_minutes ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" aria-hidden />
                    {fmt(dict.common.minutes, { n: c.duration_minutes })}
                  </span>
                ) : null}
              </div>
              {c.intake_questions.length ? (
                <div className="mt-4 rounded-lg bg-muted/60 p-4">
                  <h3 className="font-sans text-sm font-semibold tracking-normal">{t.asked}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {c.intake_questions.map((q) => (
                      <li key={q.id}>{q.label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-6 pt-2">
                <Button asChild>
                  <Link href={`/dashboard/requests/new?category=${c.id}`}>{t.request}</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
