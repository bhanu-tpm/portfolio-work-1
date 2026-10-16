"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "cn";
import { useIsActive, usePrefersReducedMotion } from "@/hooks/use-motion";
import { fmt } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

/**
 * Warm photo collage with a looping conversation: a student asks, "typing…"
 * appears, then guidance arrives. Layers shift with the mouse for depth.
 * Pauses off-screen; static for reduced motion.
 * Photos: Unsplash License stock portraits (see docs/IMAGE_CREDITS.md).
 */

const PHOTOS = [
  { src: "/people/portrait-1.webp", box: "top-[9%] left-[8%] w-[52%]", shape: "blob-a", depth: 18, tilt: "-3deg", sizes: "(min-width: 768px) 16rem, 50vw" },
  { src: "/people/portrait-2.webp", box: "top-[4%] right-[4%] w-[36%]", shape: "blob-c", depth: 30, tilt: "4deg", sizes: "(min-width: 768px) 11rem, 36vw" },
  { src: "/people/portrait-3.webp", box: "right-[6%] bottom-[8%] w-[46%]", shape: "blob-b", depth: 22, tilt: "2deg", sizes: "(min-width: 768px) 14rem, 46vw" },
  { src: "/people/portrait-4.webp", box: "bottom-[14%] left-[12%] w-[28%]", shape: "rounded-full", depth: 36, tilt: "0deg", sizes: "(min-width: 768px) 9rem, 28vw" },
] as const;

/** Which portrait "asks" each question in the conversation (text comes from the dictionary). */
const SPEAKERS = [0, 1, 2, 3];

type Phase = "ask" | "typing" | "answer" | "out";
const PHASE_MS: Record<Phase, number> = { ask: 1100, typing: 1300, answer: 3200, out: 450 };
const NEXT: Record<Phase, Phase> = { ask: "typing", typing: "answer", answer: "out", out: "ask" };

function Layer({ depth, className, children }: { depth: number; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("absolute transition-transform duration-300 ease-out will-change-transform", className)}
      style={{ transform: `translate3d(calc(var(--px, 0) * ${depth}px), calc(var(--py, 0) * ${depth}px), 0)` }}
    >
      {children}
    </div>
  );
}

export function HeroCollage({ siteName }: { siteName: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const copy = t.home.collage;
  const CONVERSATION = copy.conversation.map((c, i) => ({ ...c, speaker: SPEAKERS[i % SPEAKERS.length] }));
  const reduced = usePrefersReducedMotion();
  const active = useIsActive(ref);
  const animate = active && !reduced;
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<Phase>("ask");

  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(() => {
      if (phase === "out") setTurn((t) => t + 1);
      setPhase(NEXT[phase]);
    }, PHASE_MS[phase]);
    return () => clearTimeout(timer);
  }, [animate, phase]);

  const pair = CONVERSATION[turn % CONVERSATION.length];
  const shownPhase: Phase = reduced ? "answer" : phase;
  const showQuestion = shownPhase !== "out";
  const showTyping = shownPhase === "typing";
  const showAnswer = shownPhase === "answer";
  const roundComplete = reduced || (turn % CONVERSATION.length === CONVERSATION.length - 1 && showAnswer);

  return (
    <div
      ref={ref}
      aria-hidden
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse" || reduced) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        el.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--px", "0");
        ref.current?.style.setProperty("--py", "0");
      }}
      className="relative mx-auto aspect-[5/6] w-full max-w-[30rem]"
    >
      {/* Soft colour shapes (deepest layer) */}
      <Layer depth={-10} className="inset-0">
        <div className="blob-a blob-morph absolute top-[6%] left-[4%] size-[78%] bg-[var(--peach)]" />
        <div className="blob-b blob-morph absolute right-0 bottom-[2%] size-[52%] bg-[var(--sage)] [animation-delay:-5s]" />
        <svg viewBox="0 0 120 40" className="absolute bottom-[10%] left-[2%] w-24 text-teal/60">
          <path d="M2 30 C 20 2, 40 2, 58 20 S 96 38, 118 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </Layer>
      <Layer depth={40} className="top-[1%] right-[2%] z-10">
        <svg viewBox="0 0 100 100" className="spin-slow size-12 text-primary/70">
          <path d="M50 8 L56 44 L92 50 L56 56 L50 92 L44 56 L8 50 L44 44 Z" fill="currentColor" />
        </svg>
      </Layer>

      {/* Photos */}
      {PHOTOS.map((p, i) => {
        const speaking = !reduced && pair.speaker === i && showQuestion;
        return (
          <Layer key={p.src} depth={p.depth} className={p.box}>
            <div className="float-soft" style={{ ["--tilt" as string]: p.tilt, animationDelay: `${-i * 1.3}s` }}>
              <div
                className={cn(
                  "relative overflow-hidden ring-4 ring-card shadow-[0_24px_50px_-24px_oklch(0.35_0.05_45/0.55)] transition-[box-shadow] duration-500",
                  p.shape,
                  i === 3 ? "aspect-square" : "aspect-[4/5]",
                  speaking && "ring-primary/70 shadow-[0_0_0_8px_oklch(0.55_0.13_38/0.15),0_24px_50px_-24px_oklch(0.35_0.05_45/0.55)]",
                )}
              >
                <Image src={p.src} alt="" fill sizes={p.sizes} priority={i === 0} className={cn("object-cover", i === 3 && "object-top")} />
              </div>
            </div>
          </Layer>
        );
      })}

      {/* Conversation */}
      <Layer depth={48} className="top-[44%] left-[-2%] z-20 sm:left-[-8%]">
        <div
          key={`q-${turn}`}
          className={cn(
            "max-w-[13rem] rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 text-sm font-medium shadow-lg ring-1 ring-border transition-opacity duration-300",
            showQuestion ? "pop-in opacity-100" : "opacity-0",
          )}
        >
          {pair.question}
        </div>
      </Layer>
      <Layer depth={56} className="top-[35%] right-[-2%] z-20 sm:right-[-6%]">
        {showTyping ? (
          <div className="pop-in flex items-center gap-1 rounded-2xl rounded-br-sm bg-primary px-4 py-3.5 shadow-lg">
            {[0, 1, 2].map((d) => (
              <span key={d} className="typing-dot size-2 rounded-full bg-primary-foreground/90" style={{ animationDelay: `${d * 0.15}s` }} />
            ))}
          </div>
        ) : (
          <div
            key={`a-${turn}`}
            className={cn(
              "max-w-[13rem] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-opacity duration-300",
              showAnswer ? "pop-in opacity-100" : "opacity-0",
            )}
          >
            {pair.answer}
          </div>
        )}
      </Layer>
      <Layer depth={34} className="bottom-[1%] left-[30%] z-20">
        <div
          key={roundComplete ? `ready-${Math.floor(turn / CONVERSATION.length)}` : "waiting"}
          className={cn(
            "flex items-center gap-2.5 rounded-2xl bg-card px-3.5 py-2.5 text-sm shadow-lg ring-1 ring-border transition-opacity duration-500",
            roundComplete ? "pop-in opacity-100" : "opacity-70",
          )}
        >
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full transition-colors duration-500",
              roundComplete ? "bg-[var(--sage)] text-teal" : "bg-muted text-muted-foreground",
            )}
          >
            {roundComplete ? <Check className="size-4" strokeWidth={3} /> : <span className="typing-dot size-1.5 rounded-full bg-current" />}
          </span>
          <span>
            <span className="block font-medium">{roundComplete ? copy.ready : copy.preparing}</span>
            <span className="block text-xs text-muted-foreground">{fmt(copy.from, { site: siteName })}</span>
          </span>
        </div>
      </Layer>
      <Layer depth={26} className="top-[0%] left-[40%] z-20 hidden sm:block">
        <div className="float-soft flex items-center gap-1.5 rounded-full bg-[var(--lilac)] px-3 py-1.5 text-xs font-medium text-[oklch(0.38_0.08_300)] shadow-md [animation-delay:-2.5s]">
          <Sparkles className="size-3.5" /> {copy.badge}
        </div>
      </Layer>
    </div>
  );
}
