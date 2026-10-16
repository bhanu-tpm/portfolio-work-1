"use client";

import { useRef } from "react";
import { useCycle, useIsActive, usePrefersReducedMotion } from "@/hooks/use-motion";
import { useI18n } from "@/i18n/provider";

/**
 * "You don't have to figure out your ___ alone." with the word sliding in and a
 * hand-drawn underline redrawing for each one. Screen readers get the static sentence.
 */
export function RotatingHeadline() {
  const ref = useRef<HTMLHeadingElement>(null);
  const { t } = useI18n();
  const { headlineBefore, headlineAfter, headlineWords, headlineSr } = t.home.hero;
  const reduced = usePrefersReducedMotion();
  const active = useIsActive(ref);
  const index = useCycle(headlineWords.length, 2600, active && !reduced);
  const word = reduced ? headlineWords[0] : headlineWords[index];

  return (
    <h1 ref={ref} className="mt-6 text-5xl leading-[1.12] font-semibold text-foreground sm:text-6xl lg:text-7xl">
      <span className="sr-only">{headlineSr}</span>
      <span aria-hidden>
        {headlineBefore ? `${headlineBefore} ` : null}
        <span className="relative inline-block text-primary">
          <span key={word} className="word-in inline-block">
            {word}
          </span>
          <svg viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full text-primary/60 sm:h-4">
            <path
              key={word}
              d="M3 14 C 40 4, 80 4, 110 10 S 170 18, 197 6"
              pathLength={1}
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              className="draw-on-load"
            />
          </svg>
        </span>{" "}
        {headlineAfter}
      </span>
    </h1>
  );
}
