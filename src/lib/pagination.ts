/**
 * Pure pagination helpers shared by admin list pages. No server-only imports,
 * so they are unit-testable and safe to use from any component.
 */

export const DEFAULT_PAGE_SIZE = 20;
/** Hard ceiling so a crafted ?page=999999999 can't produce absurd offsets. */
export const MAX_PAGE = 10_000;

export type SearchParamValue = string | string[] | undefined;
export type RawSearchParams = Record<string, SearchParamValue>;

/** First value of a query parameter (Next passes repeated keys as arrays). */
export function firstParam(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Parses a 1-based page number. Anything invalid becomes page 1. */
export function parsePage(value: SearchParamValue, max = MAX_PAGE): number {
  const raw = firstParam(value)?.trim();
  if (!raw || !/^\d{1,6}$/.test(raw)) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, max);
}

/** Inclusive row range for PostgREST `.range(from, to)`. */
export function pageRange(page: number, pageSize = DEFAULT_PAGE_SIZE): { from: number; to: number } {
  const safePage = Math.max(1, Math.floor(page));
  const from = (safePage - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function totalPages(count: number | null | undefined, pageSize = DEFAULT_PAGE_SIZE): number {
  if (!count || count <= 0) return 1;
  return Math.max(1, Math.ceil(count / pageSize));
}

/**
 * Builds `path?query` from a params object, dropping empty values and `page=1`
 * so URLs stay canonical.
 */
export function buildHref(path: string, params: Record<string, string | number | null | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (key === "page" && Number(value) <= 1) continue;
    qs.set(key, String(value));
  }
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}
