import { cn } from "cn";

/**
 * The Margith mark: an M drawn as two peaks (the path) with a rising sun (the potential).
 * Strokes use currentColor, so set the colour with a text-* class; the sun uses --brand-sun.
 * Decorative: always rendered next to the site name, which carries the accessible label.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="6 10 52 43" aria-hidden focusable="false" className={cn("h-6 w-auto shrink-0", className)}>
      <circle cx="32" cy="18.5" r="6" fill="var(--brand-sun)" />
      <path
        d="M10.5 48 L21 23 L32 40.5 L43 23 L53.5 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
