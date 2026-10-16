import { cn } from "cn";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-accent text-accent-foreground ring-teal/20",
  success: "bg-success/10 text-success ring-success/25",
  warning: "bg-warning/10 text-[color-mix(in_oklch,var(--warning),black_25%)] ring-warning/30",
  danger: "bg-destructive/10 text-destructive ring-destructive/25",
};

export function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {children}
    </span>
  );
}
