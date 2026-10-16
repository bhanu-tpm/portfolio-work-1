/**
 * Makes free-text input safe to embed in a PostgREST `or=(...)` filter with
 * `ilike`: strips characters that have meaning in the filter grammar or in
 * LIKE patterns.
 */
export function sanitizeSearchTerm(input: unknown, maxLength = 80): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[,()*%_\\:"'.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function parsePage(input: unknown): number {
  const n = typeof input === "string" ? Number.parseInt(input, 10) : NaN;
  return Number.isFinite(n) && n > 0 && n < 10_000 ? n : 1;
}

export function pageRange(page: number, pageSize: number): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}
