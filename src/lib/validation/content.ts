import { z } from "zod";
import { slugify } from "@/lib/format";
import { categorySchema } from "./schemas";
import { optionalText, requiredText, slugField, uuid } from "./common";

// ---------------------------------------------------------------------------
// Pure helpers shared by the content admin (blog, portfolio, categories, messages)
// ---------------------------------------------------------------------------

export const ADMIN_PAGE_SIZE = 20;

/** Parses a `?page=` search param and returns the 0-based inclusive range for Supabase `.range()`. */
export function pageRange(raw: string | string[] | undefined, perPage = ADMIN_PAGE_SIZE) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "1", 10);
  const page = Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
  const from = (page - 1) * perPage;
  return { page, from, to: from + perPage - 1, perPage };
}

export function pageCount(total: number | null | undefined, perPage = ADMIN_PAGE_SIZE) {
  return Math.max(1, Math.ceil((total ?? 0) / perPage));
}

/** Removes characters with special meaning in PostgREST filters / LIKE patterns. */
export function sanitizeSearch(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "")
    .replace(/[%_,()\\*:"'.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/** Estimated reading time at ~200 words per minute (minimum 1 minute). */
export function countWords(markdown: string) {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // links → their text
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
}

export function readingMinutes(markdown: string, wordsPerMinute = 200) {
  return Math.max(1, Math.ceil(countWords(markdown) / wordsPerMinute));
}

export const MAX_TAGS = 10;

/** "Career, CV tips, career" → [{ name: "Career", slug: "career" }, { name: "CV tips", slug: "cv-tips" }] */
export function parseTagList(input: string | undefined | null): { name: string; slug: string }[] {
  const seen = new Set<string>();
  const tags: { name: string; slug: string }[] = [];
  for (const part of (input ?? "").split(",")) {
    const name = part.trim().replace(/\s+/g, " ").slice(0, 60);
    const slug = slugify(name);
    if (!name || !slug || seen.has(slug)) continue;
    seen.add(slug);
    tags.push({ name, slug });
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

/** Safely parses a JSON-encoded hidden form field. Returns `fallback` for missing/invalid JSON. */
export function parseJsonField(raw: unknown, fallback: unknown = []): unknown {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return fallback;
  }
}

/**
 * Moves `id` one position up or down in `ids` and returns the new order,
 * or null when the move is not possible.
 */
export function moveInOrder(ids: string[], id: string, direction: "up" | "down"): string[] | null {
  const index = ids.indexOf(id);
  if (index === -1) return null;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Intake question id suggestion from its label: "Target role?" → "target_role". */
export function questionIdFromLabel(label: string) {
  return slugify(label).replace(/-/g, "_").slice(0, 40);
}

/** Object path inside a public bucket for a URL produced by `publicObjectUrl`, else null. */
export function publicObjectPath(url: string | null | undefined, bucketPublicPrefix: string) {
  if (!url || !bucketPublicPrefix) return null;
  const prefix = bucketPublicPrefix.endsWith("/") ? bucketPublicPrefix : `${bucketPublicPrefix}/`;
  if (!url.startsWith(prefix)) return null;
  const path = decodeURIComponent(url.slice(prefix.length).split("?")[0]);
  return path && !path.includes("..") ? path : null;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const POST_INTENTS = ["save", "publish", "unpublish"] as const;
export const postIntentSchema = z.enum(POST_INTENTS).catch("save");

export const POST_STATUS_FILTERS = ["all", "draft", "published", "unpublished"] as const;

export const idSchema = z.object({ id: uuid });

export const blogCategorySchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  name: requiredText(2, 80, "Name"),
  slug: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), slugField.optional()),
  nameHi: optionalText(80),
});

/** Hindi display name for an existing tag (tags themselves are created from the post editor). */
export const blogTagHindiSchema = z.object({
  id: uuid,
  nameHi: optionalText(60),
});

export const moveSchema = z.object({ id: uuid, direction: z.enum(["up", "down"]) });

export const toggleSchema = z.object({
  id: uuid,
  value: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const KNOWN_FORMATS = ["video", "phone", "in_person"] as const;

/** categorySchema + unique intake question ids + known formats only. */
export const categoryFormSchema = categorySchema
  .extend({
    formats: z
      .array(z.enum(KNOWN_FORMATS, "Unknown format"))
      .min(1, "Select at least one format"),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    for (const q of data.intakeQuestions) {
      if (ids.has(q.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["intakeQuestions"],
          message: `Question id "${q.id}" is used more than once`,
        });
      }
      ids.add(q.id);
    }
  });
export type CategoryFormInput = z.infer<typeof categoryFormSchema>;
