"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, MessageCircleQuestion } from "lucide-react";
import { cn } from "cn";
import { useIsActive, usePrefersReducedMotion } from "@/hooks/use-motion";
import { fmt } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

// Photos: Unsplash License stock images (see docs/IMAGE_CREDITS.md).
// Image, colour and destination per audience; the text comes from the dictionary (home.audience.items).
const AUDIENCE_META = [
  { image: "/people/students.webp", tint: "var(--peach)", href: "/services#higher-education" },
  { image: "/people/graduates.webp", tint: "var(--sage)", href: "/services#job-search-transition" },
  { image: "/people/professionals.webp", tint: "var(--lilac)", href: "/services#career-planning" },
];

const INTERVAL_MS = 5500;

/** Expanding photo panels that cycle through who the consultations are for. */
export function AudienceShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const { t, href } = useI18n();
  const AUDIENCES = t.home.audience.items.map((item, i) => ({ ...item, ...AUDIENCE_META[i % AUDIENCE_META.length] }));
  const reduced = usePrefersReducedMotion();
  const onScreen = useIsActive(ref);
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const autoplay = onScreen && !reduced && !hovering;

  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(() => setActive((a) => (a + 1) % AUDIENCE_META.length), INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [autoplay, active]);

  return (
    <div
      ref={ref}
      onPointerLeave={() => setHovering(false)}
      className="flex h-[44rem] flex-col gap-3 md:h-[30rem] md:flex-row md:gap-4"
    >
      {AUDIENCES.map((a, i) => {
        const open = i === active;
        return (
          <div
            key={a.title}
            onPointerEnter={(e) => {
              if (e.pointerType !== "mouse") return;
              setHovering(true);
              setActive(i);
            }}
            className={cn(
              "group relative min-h-0 min-w-0 overflow-hidden rounded-[2rem] shadow-sm ring-1 ring-border transition-[flex-grow,box-shadow] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
              open ? "flex-[3.2] shadow-[0_30px_60px_-30px_oklch(0.35_0.05_45/0.55)]" : "flex-1",
            )}
          >
            <Image
              src={a.image}
              alt=""
              fill
              sizes="(min-width: 768px) 60vw, 100vw"
              className={cn("object-cover transition-transform duration-[1.2s] ease-out", open ? "scale-100" : "scale-110")}
            />
            {/* Readability gradient */}
            <div
              aria-hidden
              className={cn(
                "absolute inset-0 transition-opacity duration-700",
                open
                  ? "bg-gradient-to-t from-[oklch(0.22_0.03_45/0.88)] via-[oklch(0.22_0.03_45/0.35)] to-transparent"
                  : "bg-[oklch(0.22_0.03_45/0.45)]",
              )}
            />

            {/* Progress bar for the auto-cycle */}
            {open && autoplay ? (
              <div className="absolute inset-x-6 top-5 h-1 overflow-hidden rounded-full bg-white/30">
                <span
                  key={`progress-${active}`}
                  className="carousel-progress block h-full origin-left rounded-full bg-white"
                  style={{ animationDuration: `${INTERVAL_MS}ms` }}
                />
              </div>
            ) : null}

            {/* Collapsed label / activator */}
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-expanded={open}
              aria-controls={`audience-panel-${i}`}
              className={cn(
                "absolute inset-0 flex items-end p-5 text-left text-white transition-opacity duration-500 focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:outline-none md:p-6",
                open ? "pointer-events-none opacity-0" : "opacity-100",
              )}
            >
              <span className="flex items-center gap-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-foreground"
                  style={{ background: a.tint }}
                >
                  0{i + 1}
                </span>
                <span className="font-heading text-xl font-semibold md:[writing-mode:vertical-rl] md:rotate-180 lg:[writing-mode:horizontal-tb] lg:rotate-0">
                  {a.title}
                </span>
              </span>
            </button>

            {/* Expanded content */}
            <div
              id={`audience-panel-${i}`}
              aria-hidden={!open}
              className={cn(
                "absolute inset-x-0 bottom-0 p-6 text-white transition-[opacity,transform] duration-500 md:p-8",
                open ? "translate-y-0 opacity-100 delay-200" : "pointer-events-none translate-y-6 opacity-0",
              )}
            >
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold text-foreground"
                style={{ background: a.tint }}
              >
                {fmt(t.home.audience.badge, { n: i + 1 })}
              </span>
              <h3 className="mt-3 font-heading text-3xl font-semibold md:text-4xl">{a.title}</h3>
              <p className="mt-2 max-w-md text-sm text-white/85 md:text-base">{a.body}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {a.questions.map((q, qi) => (
                  <li
                    key={`${q}-${open}`}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs backdrop-blur-sm md:text-sm",
                      open && "pop-in",
                    )}
                    style={open ? { animationDelay: `${350 + qi * 150}ms` } : undefined}
                  >
                    <MessageCircleQuestion className="size-3.5 shrink-0" aria-hidden />
                    {q}
                  </li>
                ))}
              </ul>
              <Link
                href={href(a.href)}
                tabIndex={open ? 0 : -1}
                className="btn-lift mt-5 inline-flex items-center gap-1.5 rounded-full bg-card px-5 py-2.5 text-sm font-semibold text-primary"
              >
                {a.cta} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
