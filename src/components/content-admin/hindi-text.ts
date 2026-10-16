/** Shared admin copy for optional Hindi fields (plain module: usable from server and client components). */
export const HINDI_HINT = "Leave blank to show the English text on the Hindi site.";

/** True when at least one of the given Hindi values has non-whitespace text. */
export function hasHindiText(...values: (string | null | undefined)[]) {
  return values.some((v) => typeof v === "string" && v.trim() !== "");
}
