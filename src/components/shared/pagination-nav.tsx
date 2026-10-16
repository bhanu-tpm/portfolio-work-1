import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { buildHref } from "@/lib/pagination";

/**
 * Server-rendered previous/next pagination that preserves the current filters.
 * Works without JavaScript. `params` are the active (already validated) filters.
 */
export function PaginationNav({
  path,
  page,
  totalPages,
  totalCount,
  params = {},
  className,
}: {
  path: string;
  page: number;
  totalPages: number;
  totalCount?: number | null;
  params?: Record<string, string | number | null | undefined>;
  className?: string;
}) {
  if (totalPages <= 1 && !totalCount) return null;
  const prev = page > 1 ? buildHref(path, { ...params, page: page - 1 }) : null;
  const next = page < totalPages ? buildHref(path, { ...params, page: page + 1 }) : null;
  const linkClass =
    "inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
  const disabledClass = "inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm text-muted-foreground opacity-50";

  return (
    <nav aria-label="Pagination" className={cn("mt-4 flex items-center justify-between gap-3", className)}>
      {prev ? (
        <Link href={prev} className={linkClass} rel="prev">
          <ChevronLeft className="size-4" aria-hidden />
          Previous
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          <ChevronLeft className="size-4" aria-hidden />
          Previous
        </span>
      )}
      <p className="text-center text-xs text-muted-foreground sm:text-sm" aria-live="polite">
        Page {Math.min(page, totalPages)} of {totalPages}
        {typeof totalCount === "number" ? <span className="hidden sm:inline"> · {totalCount} total</span> : null}
      </p>
      {next ? (
        <Link href={next} className={linkClass} rel="next">
          Next
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          Next
          <ChevronRight className="size-4" aria-hidden />
        </span>
      )}
    </nav>
  );
}
