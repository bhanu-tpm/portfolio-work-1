"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileText,
  Globe2,
  GraduationCap,
  Pause,
  Play,
  RefreshCcw,
  Sparkles,
  Sunrise,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { useIsActive, usePrefersReducedMotion } from "@/hooks/use-motion";
import { fmt } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

// Service link and icon for each question; the question text comes from the dictionary (home.questions.items).
const QUESTION_META: { service: string; icon: LucideIcon }[] = [
  { service: "higher-education", icon: GraduationCap },
  { service: "job-search-transition", icon: RefreshCcw },
  { service: "resume-guidance", icon: FileText },
  { service: "job-search-transition", icon: BriefcaseBusiness },
  { service: "skills-development", icon: Sparkles },
  { service: "higher-education", icon: Globe2 },
  { service: "higher-education", icon: Compass },
  { service: "job-search-transition", icon: Sunrise },
];

const PASTELS = ["var(--peach)", "var(--sage)", "var(--lilac)", "var(--sand)"];
const INTERVAL_MS = 3800;

const COPIES = 3; // render the list three times so there are always cards on both sides
const RESUME_AFTER_MS = 5000;

export function QuestionCarousel() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const { t, href } = useI18n();
  const copyText = t.home.questions;
  const QUESTIONS = copyText.items.map((item, i) => ({ ...item, ...QUESTION_META[i % QUESTION_META.length] }));
  const reduced = usePrefersReducedMotion();
  const onScreen = useIsActive(sectionRef);
  const n = QUESTIONS.length;
  // Index into the rendered (tripled) list; starts on the first card of the middle copy.
  const [position, setPosition] = useState(n);
  const [paused, setPaused] = useState(false);
  // True for a few seconds after the visitor swipes or clicks, so autoplay does not fight them.
  const [resting, setResting] = useState(false);
  const restTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = position % n;
  const autoplay = onScreen && !reduced && !paused && !resting;

  const centreOn = useCallback((index: number, behavior: ScrollBehavior) => {
    const track = trackRef.current;
    const card = track?.children[index] as HTMLElement | undefined;
    if (!track || !card) return;
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.clientWidth) / 2, behavior });
  }, []);

  // Start centred in the middle copy (instantly, before the first paint where possible).
  useEffect(() => {
    centreOn(n, "instant");
    const onResize = () => centreOn(n + (position % n), "instant");
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the card nearest the centre; when scrolling settles in an outer copy,
  // jump invisibly to the same card in the middle copy so the loop never ends.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const nearest = () => {
      const centre = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDistance = Infinity;
      Array.from(track.children).forEach((child, i) => {
        const el = child as HTMLElement;
        const distance = Math.abs(el.offsetLeft + el.clientWidth / 2 - centre);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      return best;
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPosition(nearest()));
      clearTimeout(settle);
      settle = setTimeout(() => {
        const index = nearest();
        if (index < n || index >= 2 * n) {
          const middle = n + (index % n);
          centreOn(middle, "instant");
          setPosition(middle);
        }
      }, 160);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [n, centreOn]);

  // Auto-advance. After a manual interaction, wait a few seconds before resuming.
  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(() => centreOn(position + 1, "smooth"), INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [autoplay, position, centreOn]);

  useEffect(() => () => clearTimeout(restTimer.current), []);

  const interact = () => {
    setResting(true);
    clearTimeout(restTimer.current);
    restTimer.current = setTimeout(() => setResting(false), RESUME_AFTER_MS);
  };
  const step = (delta: number) => {
    interact();
    centreOn(position + delta, "smooth");
  };
  const goToReal = (real: number) => {
    interact();
    centreOn(n + real, "smooth");
  };

  return (
    <div ref={sectionRef} role="region" aria-roledescription="carousel" aria-label={copyText.region}>
      <ul
        ref={trackRef}
        onPointerDown={interact}
        onWheel={interact}
        onTouchStart={interact}
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto px-[11%] py-6 sm:px-[calc(50%-11rem)]"
      >
        {Array.from({ length: COPIES }, (_, copy) => QUESTIONS.map((q, i) => ({ q, i, copy }))).flat().map(({ q, i, copy }, index) => {
          const isActive = index === position;
          const isClone = copy !== 1;
          return (
            <li
              key={`${copy}-${q.question}`}
              role={isClone ? undefined : "group"}
              aria-roledescription={isClone ? undefined : "slide"}
              aria-label={isClone ? undefined : fmt(copyText.slide, { n: i + 1, total: n })}
              aria-hidden={isClone || undefined}
              className="w-[78%] shrink-0 snap-center sm:w-[22rem]"
            >
              <div
                className={cn(
                  "flex h-full flex-col rounded-[1.75rem] p-6 text-left ring-1 transition-[transform,opacity,box-shadow,background-color] duration-500 ease-out",
                  isActive
                    ? "scale-100 opacity-100 shadow-[0_30px_60px_-30px_oklch(0.35_0.05_45/0.5)] ring-transparent"
                    : "scale-[0.92] bg-card opacity-60 ring-border",
                )}
                style={isActive ? { background: PASTELS[i % PASTELS.length] } : undefined}
              >
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full transition-colors duration-500",
                    isActive ? "bg-card text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <q.icon className="size-5" aria-hidden />
                </span>
                <p className="mt-5 font-heading text-2xl leading-snug font-semibold">{q.question}</p>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/75">{q.answer}</p>
                <Link
                  href={href(`/services#${q.service}`)}
                  tabIndex={isActive && !isClone ? 0 : -1}
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  {copyText.explore} <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Controls */}
      <div className="mt-2 flex items-center justify-center gap-3 px-4">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={copyText.previous}
          className="flex size-10 items-center justify-center rounded-full bg-card ring-1 ring-border transition-colors hover:bg-[var(--sand)]"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex items-center gap-1.5">
          {QUESTIONS.map((q, i) => (
            <button
              key={q.question}
              type="button"
              onClick={() => goToReal(i)}
              aria-label={fmt(copyText.goTo, { n: i + 1 })}
              aria-current={i === active ? "true" : undefined}
              className={cn(
                "relative h-2 overflow-hidden rounded-full transition-all duration-300",
                i === active ? "w-10 bg-primary/25" : "w-2 bg-foreground/20 hover:bg-foreground/40",
              )}
            >
              {i === active ? (
                <span
                  key={`${active}-${autoplay}`}
                  className={cn("carousel-progress absolute inset-0 origin-left rounded-full bg-primary", !autoplay && "scale-x-100")}
                  style={autoplay ? { animationDuration: `${INTERVAL_MS}ms` } : { animation: "none" }}
                />
              ) : null}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={copyText.next}
          className="flex size-10 items-center justify-center rounded-full bg-card ring-1 ring-border transition-colors hover:bg-[var(--sand)]"
        >
          <ChevronRight className="size-5" />
        </button>
        {!reduced ? (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? copyText.play : copyText.pause}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--sand)] hover:text-foreground"
          >
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
