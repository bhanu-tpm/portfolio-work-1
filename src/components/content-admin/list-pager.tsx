import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Previous / next pagination that preserves the other search params. */
export function ListPager({
  basePath,
  params,
  page,
  pageCount,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
  total: number;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(page - 1)} rel="prev">
            <ChevronLeft aria-hidden /> Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled aria-disabled>
          <ChevronLeft aria-hidden /> Previous
        </Button>
      )}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Page {page} of {pageCount} · {total} total
      </p>
      {page < pageCount ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(page + 1)} rel="next">
            Next <ChevronRight aria-hidden />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled aria-disabled>
          Next <ChevronRight aria-hidden />
        </Button>
      )}
    </nav>
  );
}
