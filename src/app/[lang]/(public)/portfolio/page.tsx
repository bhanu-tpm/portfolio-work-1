import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPortfolioItems, getSiteProfile } from "@/lib/content";
import { shouldOptimize } from "@/lib/images";
import { initials } from "@/lib/format";
import { localizePortfolioItem, localizeProfile } from "@/lib/localize";
import type { PortfolioItem, PortfolioKind } from "@/lib/db/types";
import { fmt, languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, href } = await getI18n();
  return {
    title: t.portfolio.meta.title,
    description: t.portfolio.meta.description,
    alternates: { ...languageAlternates("/portfolio"), canonical: href("/portfolio") },
  };
}

const SECTIONS: PortfolioKind[] = ["expertise", "experience", "project", "qualification", "certification"];

function ItemList({ items, compact, newTabLabel }: { items: PortfolioItem[]; compact?: boolean; newTabLabel: string }) {
  return (
    <ul className={compact ? "grid gap-4 sm:grid-cols-2" : "space-y-6"}>
      {items.map((item) => (
        <li key={item.id} className={compact ? "rounded-xl bg-card p-5 ring-1 ring-foreground/10" : "border-l-2 border-teal/40 pl-5"}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-sans text-base font-semibold tracking-normal">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  {item.title} <ExternalLink className="size-3.5" aria-label={newTabLabel} />
                </a>
              ) : (
                item.title
              )}
            </h3>
            {item.period ? <span className="text-sm text-muted-foreground">{item.period}</span> : null}
          </div>
          {item.subtitle ? <p className="text-sm text-teal">{item.subtitle}</p> : null}
          {item.description ? <p className="mt-1.5 text-sm text-muted-foreground">{item.description}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export default async function PortfolioPage() {
  const { locale, t: dict } = await getI18n();
  const t = dict.portfolio;
  const [rawProfile, rawItems] = await Promise.all([getSiteProfile(), getPortfolioItems()]);
  const profile = localizeProfile(rawProfile, locale);
  const items = rawItems.map((i) => localizePortfolioItem(i, locale));
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <header className="grid items-center gap-8 md:grid-cols-[220px_1fr]">
        {profile.photo_url ? (
          <Image
            src={profile.photo_url}
            alt={fmt(t.portraitAlt, { name: profile.full_name })}
            width={220}
            height={220}
            unoptimized={!shouldOptimize(profile.photo_url)}
            className="size-44 rounded-full object-cover ring-1 ring-foreground/10 md:size-[220px]"
          />
        ) : (
          <div aria-hidden className="flex size-44 items-center justify-center rounded-full bg-gradient-to-br from-teal/30 to-[oklch(0.45_0.15_265/0.4)] text-5xl font-semibold ring-1 ring-white/10 md:size-[220px]">
            {initials(profile.full_name)}
          </div>
        )}
        <div>
          <h1 className="text-4xl font-semibold text-primary">{profile.full_name}</h1>
          <p className="mt-2 text-lg text-teal">{profile.headline}</p>
          <p className="mt-4 text-muted-foreground">{profile.short_bio}</p>
        </div>
      </header>

      {profile.long_bio ? (
        <section className="mt-14" aria-labelledby="bio">
          <h2 id="bio" className="text-2xl font-semibold">
            {t.biography}
          </h2>
          <p className="mt-3 leading-relaxed whitespace-pre-line text-muted-foreground">{profile.long_bio}</p>
        </section>
      ) : null}

      {SECTIONS.map((kind) => {
        const list = items.filter((i) => i.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="mt-14" aria-labelledby={`section-${kind}`}>
            <h2 id={`section-${kind}`} className="mb-5 text-2xl font-semibold">
              {t.sections[kind]}
            </h2>
            <ItemList items={list} compact={kind === "expertise"} newTabLabel={t.opensInNewTab} />
          </section>
        );
      })}

      {profile.approach ? (
        <section className="mt-14 rounded-2xl bg-secondary/60 p-6 sm:p-8" aria-labelledby="approach">
          <h2 id="approach" className="text-2xl font-semibold">
            {t.approach}
          </h2>
          <p className="mt-3 leading-relaxed whitespace-pre-line text-muted-foreground">{profile.approach}</p>
        </section>
      ) : null}

      <div className="mt-14 flex flex-col items-start gap-3 border-t pt-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-lg font-medium">{t.cta}</p>
        <Button asChild size="lg">
          <Link href="/dashboard/requests/new">{t.book}</Link>
        </Button>
      </div>
    </div>
  );
}
