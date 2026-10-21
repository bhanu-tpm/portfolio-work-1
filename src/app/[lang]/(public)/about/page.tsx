import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Compass, Eye, GraduationCap, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, href } = await getI18n();
  return {
    title: t.portfolio.meta.title,
    description: t.portfolio.meta.description,
    alternates: { ...languageAlternates("/about"), canonical: href("/about") },
  };
}

/** Icons for t.portfolio.whatWeDo.items, in order. */
const WHAT_WE_DO_ICONS = [Compass, GraduationCap, Sparkles, BriefcaseBusiness];

export default async function AboutPage() {
  const { t: dict } = await getI18n();
  const t = dict.portfolio;
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <header className="max-w-3xl">
        <h1 className="text-4xl font-semibold text-primary sm:text-5xl">{t.title}</h1>
        <p className="mt-3 text-xl font-medium text-teal">{t.tagline}</p>
        {t.intro.map((p) => (
          <p key={p} className="mt-5 text-lg leading-relaxed text-muted-foreground">
            {p}
          </p>
        ))}
      </header>

      <section aria-labelledby="story" className="mt-14 max-w-3xl">
        <h2 id="story" className="text-2xl font-semibold">
          {t.story.heading}
        </h2>
        {t.story.paragraphs.map((p) => (
          <p key={p} className="mt-3 leading-relaxed text-muted-foreground">
            {p}
          </p>
        ))}
      </section>

      <div className="mt-14 grid gap-5 sm:grid-cols-2">
        {[
          { ...t.mission, id: "mission", Icon: Target },
          { ...t.vision, id: "vision", Icon: Eye },
        ].map(({ id, heading, body, Icon }) => (
          <section key={id} aria-labelledby={id} className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
            <Icon className="size-6 text-teal" aria-hidden />
            <h2 id={id} className="mt-3 text-xl font-semibold">
              {heading}
            </h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">{body}</p>
          </section>
        ))}
      </div>

      <section aria-labelledby="what-we-do" className="mt-14">
        <h2 id="what-we-do" className="text-2xl font-semibold">
          {t.whatWeDo.heading}
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {t.whatWeDo.items.map((item, i) => {
            const Icon = WHAT_WE_DO_ICONS[i % WHAT_WE_DO_ICONS.length];
            return (
              <li key={item.title} className="flex gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-sans text-base font-semibold tracking-normal">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="approach" className="mt-14">
        <h2 id="approach" className="text-2xl font-semibold">
          {t.approach.heading}
        </h2>
        <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {t.approach.steps.map((step, i) => (
            <li key={step} className="rounded-xl bg-[var(--sage)] px-4 py-3">
              <span className="block text-xs font-semibold text-teal">{String(i + 1).padStart(2, "0")}</span>
              <span className="mt-1 block font-heading text-lg font-semibold">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 max-w-3xl leading-relaxed text-muted-foreground">{t.approach.body}</p>
      </section>

      <section aria-labelledby="commitment" className="mt-14 max-w-3xl">
        <h2 id="commitment" className="text-2xl font-semibold">
          {t.commitment.heading}
        </h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">{t.commitment.body}</p>
      </section>

      <section aria-labelledby="next-step" className="mt-16 rounded-[2rem] bg-[var(--peach)] p-8 sm:p-10">
        <h2 id="next-step" className="text-2xl font-semibold sm:text-3xl">
          {t.cta.heading}
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-foreground/80">{t.cta.body}</p>
        <Button asChild size="lg" className="btn-lift mt-6 h-12 rounded-full px-7 text-base">
          <Link href="/dashboard/requests/new">
            {t.cta.book} <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
