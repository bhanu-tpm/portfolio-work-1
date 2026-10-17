import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, MessageCircleHeart, Sparkles } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { getActiveCategories, getPublishedPosts, getSiteProfile } from "@/lib/content";
import { shouldOptimize } from "@/lib/images";
import { initials as initialsOf } from "@/lib/format";
import { PostCard } from "@/components/site/post-card";
import { AudienceShowcase } from "@/components/site/audience-showcase";
import { HeroCollage } from "@/components/site/hero-collage";
import { ServiceExplorer } from "@/components/site/service-explorer";
import { RotatingHeadline } from "@/components/site/rotating-headline";
import { QuestionCarousel } from "@/components/site/question-carousel";
import { localizeCategory, localizeProfile } from "@/lib/localize";
import { fmt, languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { isAiConfigured } from "@/lib/env";
import type { Metadata } from "next";

/** The home page features the first services by sort order; the services page lists them all. */
const HOME_SERVICE_COUNT = 6;

export async function generateMetadata(): Promise<Metadata> {
  const { href } = await getI18n();
  return { alternates: { ...languageAlternates("/"), canonical: href("/") } };
}

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Career Consultation";

const PASTELS = ["var(--peach)", "var(--sage)", "var(--lilac)", "var(--sand)"];


function Wave({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={cn("block h-10 w-full sm:h-16", flip && "rotate-180", className)}
    >
      <path d="M0 40 C 240 90, 480 -10, 720 30 S 1200 80, 1440 30 L1440 80 L0 80 Z" fill="currentColor" />
    </svg>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-[var(--sage)] px-3 py-1 text-sm font-medium text-teal">
      {children}
    </p>
  );
}

export default async function HomePage() {
  const { locale, t: dict, href } = await getI18n();
  const t = dict.home;
  const [rawProfile, rawCategories, posts] = await Promise.all([
    getSiteProfile(),
    getActiveCategories(),
    getPublishedPosts(),
  ]);
  const profile = localizeProfile(rawProfile, locale);
  const categories = rawCategories.map((c) => localizeCategory(c, locale));
  const initials = initialsOf(profile.full_name);

  return (
    <>
      {/* ------------------------------------------------------------------ Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-12 pb-20 sm:px-6 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:pb-24">
          <div className="rise-in">
            <p className="inline-flex items-center gap-2 rounded-full bg-card py-1 pr-4 pl-1 text-sm shadow-sm ring-1 ring-border">
              {profile.photo_url ? (
                <Image
                  src={profile.photo_url}
                  alt=""
                  width={28}
                  height={28}
                  unoptimized={!shouldOptimize(profile.photo_url)}
                  className="size-7 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </span>
              )}
              {fmt(t.hero.greeting, { name: profile.full_name, headline: profile.headline })}
            </p>
            <RotatingHeadline />
            <p className="mt-7 max-w-xl text-lg text-muted-foreground">{profile.short_bio}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="btn-lift h-12 rounded-full px-7 text-base">
                <Link href="/dashboard/requests/new">
                  {t.hero.book} <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-5 text-base hover:bg-[var(--sand)]">
                <Link href={href("/portfolio")}>{t.hero.portfolio}</Link>
              </Button>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {t.hero.checks.map((check) => (
                <li key={check} className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-[var(--sage)] text-teal">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                  {check}
                </li>
              ))}
            </ul>
          </div>
          <div className="rise-in [animation-delay:150ms]">
            <HeroCollage siteName={siteName} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Topic chips */}
      <section aria-labelledby="topics-heading" className="pb-20 text-center">
        <h2 id="topics-heading" className="reveal px-4 font-heading text-2xl font-semibold sm:text-3xl">
          {t.questions.title}
        </h2>
        <p className="reveal mx-auto mt-3 max-w-xl px-4 text-muted-foreground">{t.questions.intro}</p>
        <div className="reveal mt-6">
          <QuestionCarousel />
        </div>
      </section>

      {/* ------------------------------------------------------------ Who I help */}
      <section aria-labelledby="audience-heading" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>{t.audience.eyebrow}</Eyebrow>
          <h2 id="audience-heading" className="mt-4 text-3xl font-semibold sm:text-5xl">
            {t.audience.title}
          </h2>
        </div>
        <div className="reveal mt-12">
          <AudienceShowcase />
        </div>
      </section>

      {/* -------------------------------------------------------------- Services */}
      <section aria-labelledby="services-heading" className="text-[var(--sand)]">
        <Wave />
        <div className="bg-[var(--sand)] text-foreground">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
            <div className="reveal flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <Eyebrow>{t.services.eyebrow}</Eyebrow>
                <h2 id="services-heading" className="mt-4 text-3xl font-semibold sm:text-5xl">
                  {t.services.title}
                </h2>
              </div>
              <Link href={href("/services")} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                {t.services.seeAll} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            {categories.length ? (
              <div className="reveal mt-12">
                <ServiceExplorer
                  categories={categories.slice(0, HOME_SERVICE_COUNT).map((c) => ({
                    id: c.id,
                    slug: c.slug,
                    title: c.title,
                    short_description: c.short_description,
                    scope: c.scope,
                    formats: c.formats,
                    duration_minutes: c.duration_minutes,
                    intake_questions: c.intake_questions,
                  }))}
                />
              </div>
            ) : (
              <p className="mt-10 text-muted-foreground">{t.services.empty}</p>
            )}
          </div>
        </div>
        <Wave flip />
      </section>

      {/* --------------------------------------------------------------- Process */}
      <section aria-labelledby="process-heading" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="reveal mx-auto max-w-2xl text-center">
          <Eyebrow>{t.steps.eyebrow}</Eyebrow>
          <h2 id="process-heading" className="mt-4 text-3xl font-semibold sm:text-5xl">
            {t.steps.title}
          </h2>
        </div>
        <div className="relative mt-16">
          {/* Dashed path that draws itself as you scroll (desktop) */}
          <svg
            aria-hidden
            viewBox="0 0 1000 120"
            preserveAspectRatio="none"
            className="absolute top-2 left-[12%] hidden h-24 w-[76%] text-primary/40 md:block"
          >
            <path
              d="M0 60 C 160 -10, 330 130, 500 60 S 840 -10, 1000 60"
              pathLength={1}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="draw-on-scroll"
            />
          </svg>
          <ol className="relative grid gap-12 md:grid-cols-3 md:gap-8">
            {t.steps.items.map((step, i) => (
              <li key={step.title} className="reveal text-center">
                <span
                  className="blob-a mx-auto flex size-24 items-center justify-center font-heading text-4xl font-semibold text-foreground shadow-sm"
                  style={{ background: PASTELS[i % PASTELS.length] }}
                >
                  {i + 1}
                </span>
                <h3 className="mt-6 font-heading text-2xl font-semibold">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ----------------------------------------------------------------- About */}
      <section aria-labelledby="about-heading" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="reveal grid items-center gap-12 md:grid-cols-[0.9fr_1.1fr]">
          <div className={cn("relative mx-auto w-full", profile.photo_url ? "max-w-sm" : "max-w-[16rem]")}>
            <div aria-hidden className="blob-b blob-morph absolute -inset-4 bg-[var(--peach)]" />
            {profile.photo_url ? (
              <div className="blob-a relative aspect-[4/5] overflow-hidden ring-4 ring-card">
                <Image
                  src={profile.photo_url}
                  alt={fmt(t.about.portraitAlt, { name: profile.full_name })}
                  fill
                  sizes="(min-width: 768px) 24rem, 90vw"
                  unoptimized={!shouldOptimize(profile.photo_url)}
                  className="object-cover"
                />
              </div>
            ) : (
              <div
                aria-hidden
                className="blob-a relative flex aspect-[4/5] items-center justify-center bg-card font-heading text-7xl font-semibold text-primary ring-4 ring-card"
              >
                {initials}
              </div>
            )}
          </div>
          <div>
            <Eyebrow>
              <MessageCircleHeart className="size-4" aria-hidden /> {t.about.eyebrow}
            </Eyebrow>
            <h2 id="about-heading" className="mt-4 text-3xl font-semibold sm:text-5xl">
              {fmt(t.about.title, { name: profile.full_name })}
            </h2>
            <p className="mt-5 text-lg leading-relaxed whitespace-pre-line text-muted-foreground">
              {profile.long_bio || profile.short_bio}
            </p>
            <blockquote className="mt-6 rounded-2xl bg-[var(--sand)] p-5 font-heading text-lg text-foreground/90 italic">
              “
              {profile.approach || t.about.defaultApproach}
              ”
            </blockquote>
            {profile.credibility_points.length ? (
              <ul className="mt-6 flex flex-wrap gap-2">
                {profile.credibility_points.map((point) => (
                  <li key={point} className="rounded-full bg-card px-3 py-1 text-sm ring-1 ring-border">
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
            <Link href={href("/portfolio")} className="mt-6 inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {t.about.more} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- AI assistant */}
      {isAiConfigured() ? (
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="reveal relative overflow-hidden rounded-[2rem] bg-[var(--sage)] p-8 sm:p-12">
            <div aria-hidden className="blob-c blob-morph absolute -top-16 -right-16 size-56 bg-card/40" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="flex items-center gap-2 text-sm font-semibold text-teal">
                  <Sparkles className="size-4" aria-hidden /> {t.assistant.badge}
                </p>
                <h2 className="mt-2 text-3xl font-semibold">{t.assistant.title}</h2>
                <p className="mt-3 text-foreground/75">{t.assistant.body}</p>
              </div>
              <Button asChild size="lg" className="btn-lift h-12 shrink-0 rounded-full bg-teal px-6 text-base text-teal-foreground hover:bg-teal/90">
                <Link href={href("/assistant")}>{t.assistant.cta}</Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ Blog */}
      {posts.length ? (
        <section aria-labelledby="blog-heading" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="reveal flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>{t.blog.eyebrow}</Eyebrow>
              <h2 id="blog-heading" className="mt-4 text-3xl font-semibold sm:text-4xl">
                {t.blog.title}
              </h2>
            </div>
            <Link href={href("/blog")} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {t.blog.all} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {posts.slice(0, 3).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------- Final CTA */}
      <section className="text-primary">
        <Wave />
        <div className="bg-primary text-primary-foreground">
          <div className="reveal mx-auto max-w-3xl px-4 pt-10 pb-20 text-center sm:px-6">
            <h2 className="text-4xl font-semibold sm:text-5xl">{t.final.title}</h2>
            <p className="mx-auto mt-4 max-w-lg text-primary-foreground/85">{t.final.body}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="btn-lift h-12 rounded-full bg-card px-7 text-base text-primary hover:bg-card/90"
              >
                <Link href="/dashboard/requests/new">
                  {t.final.book} <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-12 rounded-full px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href={href("/contact")}>{t.final.ask}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
