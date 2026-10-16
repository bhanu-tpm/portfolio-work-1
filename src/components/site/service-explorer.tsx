"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Clock,
  Compass,
  FileText,
  GraduationCap,
  MessageCircleQuestion,
  MonitorSmartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { fmt } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";
import { useIsActive, usePrefersReducedMotion } from "@/hooks/use-motion";
import type { ConsultationCategory } from "@/lib/db/types";

// Icons for the seeded category slugs; admin-created categories fall back to a compass.
const ICONS: Record<string, LucideIcon> = {
  "career-planning": Compass,
  "higher-education": GraduationCap,
  "skills-development": Sparkles,
  "resume-guidance": FileText,
  "job-search-transition": BriefcaseBusiness,
  general: MessageCircleQuestion,
};
const PASTELS = ["var(--peach)", "var(--sage)", "var(--lilac)", "var(--sand)"];
const SHAPES = ["blob-a", "blob-b", "blob-c"];
const INTERVAL_MS = 5000;

export type ExplorerCategory = Pick<
  ConsultationCategory,
  "id" | "slug" | "title" | "short_description" | "scope" | "formats" | "duration_minutes" | "intake_questions"
>;

/** Auto-cycling, hover/click/keyboard-selectable showcase of consultation services. */
export function ServiceExplorer({ categories }: { categories: ExplorerCategory[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { t, href } = useI18n();
  const copy = t.home.services;
  const formatName = (f: string) => t.common.formats[f] ?? f.replace(/_/g, " ");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = usePrefersReducedMotion();
  const onScreen = useIsActive(ref);
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const autoplay = onScreen && !reduced && !hovering && !focused && categories.length > 1;

  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(() => setActive((a) => (a + 1) % categories.length), INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [autoplay, active, categories.length]);

  // On narrow screens the tabs scroll horizontally: keep the active one in view
  // (scrolling only the tab strip, never the page).
  useEffect(() => {
    const tab = tabRefs.current[active];
    const strip = tab?.parentElement;
    if (!tab || !strip || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({
      left: tab.offsetLeft - (strip.clientWidth - tab.clientWidth) / 2,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [active, reduced]);

  const select = (index: number, focus = false) => {
    const next = (index + categories.length) % categories.length;
    setActive(next);
    if (focus) tabRefs.current[next]?.focus();
  };

  const c = categories[active];
  if (!c) return null;
  const Icon = ICONS[c.slug] ?? Compass;
  const tint = PASTELS[active % PASTELS.length];

  return (
    <div
      ref={ref}
      onPointerLeave={() => setHovering(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10"
    >
      {/* Service list (tabs) */}
      <div
        role="tablist"
        aria-label={copy.tablist}
        aria-orientation="vertical"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            e.preventDefault();
            select(active + 1, true);
          } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            e.preventDefault();
            select(active - 1, true);
          } else if (e.key === "Home") {
            e.preventDefault();
            select(0, true);
          } else if (e.key === "End") {
            e.preventDefault();
            select(categories.length - 1, true);
          }
        }}
        className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
      >
        {categories.map((cat, i) => {
          const TabIcon = ICONS[cat.slug] ?? Compass;
          const selected = i === active;
          return (
            <button
              key={cat.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`service-tab-${cat.id}`}
              aria-selected={selected}
              aria-controls="service-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => select(i)}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                setHovering(true);
                setActive(i);
              }}
              className={cn(
                "relative flex shrink-0 snap-start items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left transition-[background-color,box-shadow,transform] duration-300 lg:py-4",
                selected ? "bg-card shadow-md ring-1 ring-border lg:translate-x-2" : "hover:bg-card/60",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
                  selected ? "text-foreground" : "bg-muted text-muted-foreground",
                )}
                style={selected ? { background: PASTELS[i % PASTELS.length] } : undefined}
              >
                <TabIcon className="size-5" aria-hidden />
              </span>
              <span className={cn("text-sm font-semibold whitespace-nowrap lg:text-base lg:whitespace-normal", !selected && "text-foreground/70")}>
                {cat.title}
              </span>
              <ArrowRight
                className={cn(
                  "ml-auto hidden size-4 shrink-0 text-primary transition-all duration-300 lg:block",
                  selected ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0",
                )}
                aria-hidden
              />
              {/* Progress while auto-cycling */}
              {selected && autoplay ? (
                <span
                  key={`progress-${active}`}
                  aria-hidden
                  className="carousel-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary"
                  style={{ animationDuration: `${INTERVAL_MS}ms` }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      <div
        id="service-panel"
        role="tabpanel"
        aria-labelledby={`service-tab-${c.id}`}
        className="relative overflow-hidden rounded-[2rem] p-7 shadow-[0_30px_60px_-34px_oklch(0.35_0.05_45/0.5)] transition-colors duration-700 sm:p-10"
        style={{ background: tint }}
      >
        <div aria-hidden className={cn("blob-morph absolute -top-16 -right-16 size-64 bg-card/35", SHAPES[active % SHAPES.length])} />
        <div aria-hidden className="blob-b blob-morph absolute -bottom-24 -left-10 size-56 bg-card/20 [animation-delay:-6s]" />

        <div key={c.id} className="relative">
          <span className={cn("pop-in flex size-16 items-center justify-center bg-card text-primary shadow-sm", SHAPES[active % SHAPES.length])}>
            <Icon className="size-7" aria-hidden />
          </span>
          <h3 className="word-in mt-6 font-heading text-3xl font-semibold sm:text-4xl">{c.title}</h3>
          <p className="rise-in mt-3 max-w-xl text-base text-foreground/80 [animation-delay:80ms] sm:text-lg">
            {c.short_description}
          </p>

          {c.scope ? (
            <div className="rise-in mt-6 rounded-2xl bg-card/70 p-4 [animation-delay:160ms]">
              <p className="text-xs font-semibold tracking-wider text-primary uppercase">{copy.included}</p>
              <p className="mt-1 text-sm text-foreground/85">{c.scope}</p>
            </div>
          ) : null}

          <div className="rise-in mt-5 flex flex-wrap gap-2 text-sm [animation-delay:220ms]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-3 py-1.5">
              <MonitorSmartphone className="size-4 text-primary" aria-hidden />
              {c.formats.map(formatName).join(t.common.or)}
            </span>
            {c.duration_minutes ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-3 py-1.5">
                <Clock className="size-4 text-primary" aria-hidden />
                {fmt(t.common.minutes, { n: c.duration_minutes })}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-3 py-1.5">
              <Check className="size-4 text-primary" aria-hidden />
              {copy.writtenPlan}
            </span>
          </div>

          {c.intake_questions.length ? (
            <div className="mt-6">
              <p className="text-xs font-semibold tracking-wider text-foreground/60 uppercase">{copy.asked}</p>
              <ul className="mt-2 space-y-1.5">
                {c.intake_questions.slice(0, 3).map((q, qi) => (
                  <li
                    key={q.id}
                    className="pop-in flex items-start gap-2 text-sm text-foreground/85"
                    style={{ animationDelay: `${280 + qi * 120}ms` }}
                  >
                    <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {q.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rise-in mt-8 flex flex-col gap-3 [animation-delay:320ms] sm:flex-row sm:items-center">
            <Link
              href={`/dashboard/requests/new?category=${c.id}`}
              className="btn-lift inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              {copy.request} <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href={href(`/services#${c.slug}`)}
              className="inline-flex items-center justify-center gap-1 rounded-full px-4 py-3 text-sm font-semibold text-foreground hover:bg-card/50"
            >
              {copy.learnMore}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
