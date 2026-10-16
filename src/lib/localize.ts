import type { Locale } from "@/i18n/config";
import type {
  BlogCategory,
  BlogTag,
  ConsultationCategory,
  IntakeQuestion,
  PortfolioItem,
  SiteProfile,
} from "@/lib/db/types";

/**
 * Admin-authored content has optional Hindi columns (`<field>_hi`). These helpers
 * return the record with the Hindi text in the base field when the locale is Hindi
 * and a translation exists, falling back to English otherwise.
 */

function pick(en: string, hi: string | null | undefined, locale: Locale) {
  return locale === "hi" && hi && hi.trim() ? hi : en;
}
function pickNullable(en: string | null, hi: string | null | undefined, locale: Locale) {
  return locale === "hi" && hi && hi.trim() ? hi : en;
}

/** Placeholder name used by the seed/fallback profile until the consultant sets theirs. */
export const PLACEHOLDER_NAME = "Your Name";

export function localizeProfile(p: SiteProfile, locale: Locale): SiteProfile {
  if (locale !== "hi") return p;
  return {
    ...p,
    full_name: p.full_name === PLACEHOLDER_NAME ? "[आपका नाम]" : p.full_name,
    headline: pick(p.headline, p.headline_hi, locale),
    short_bio: pick(p.short_bio, p.short_bio_hi, locale),
    long_bio: pick(p.long_bio, p.long_bio_hi, locale),
    approach: pick(p.approach, p.approach_hi, locale),
    location: pickNullable(p.location, p.location_hi, locale),
    credibility_points: p.credibility_points_hi?.length ? p.credibility_points_hi : p.credibility_points,
  };
}

export function localizeQuestion(q: IntakeQuestion, locale: Locale): IntakeQuestion {
  return { ...q, label: pick(q.label, q.label_hi, locale) };
}

export function localizeCategory<T extends Pick<ConsultationCategory, "title" | "short_description" | "scope" | "intake_questions" | "title_hi" | "short_description_hi" | "scope_hi">>(
  c: T,
  locale: Locale,
): T {
  if (locale !== "hi") return c;
  return {
    ...c,
    title: pick(c.title, c.title_hi, locale),
    short_description: pick(c.short_description, c.short_description_hi, locale),
    scope: pick(c.scope, c.scope_hi, locale),
    intake_questions: c.intake_questions.map((q) => localizeQuestion(q, locale)),
  };
}

export function localizePortfolioItem(item: PortfolioItem, locale: Locale): PortfolioItem {
  if (locale !== "hi") return item;
  return {
    ...item,
    title: pick(item.title, item.title_hi, locale),
    subtitle: pickNullable(item.subtitle, item.subtitle_hi, locale),
    description: pickNullable(item.description, item.description_hi, locale),
    period: pickNullable(item.period, item.period_hi, locale),
  };
}

export function localizeTaxonomy<T extends BlogCategory | BlogTag>(t: T, locale: Locale): T {
  return locale === "hi" ? { ...t, name: pick(t.name, t.name_hi, locale) } : t;
}

type PostFields = {
  title: string;
  excerpt: string;
  seo_title: string | null;
  seo_description: string | null;
  cover_image_alt: string | null;
  title_hi?: string | null;
  excerpt_hi?: string | null;
  seo_title_hi?: string | null;
  seo_description_hi?: string | null;
  cover_image_alt_hi?: string | null;
  category: BlogCategory | null;
  tags: BlogTag[];
};

/** Localises a post's listing fields. `translated` tells whether a Hindi title exists. */
export function localizePost<T extends PostFields>(post: T, locale: Locale): T & { translated: boolean } {
  if (locale !== "hi") return { ...post, translated: true };
  return {
    ...post,
    title: pick(post.title, post.title_hi, locale),
    excerpt: pick(post.excerpt, post.excerpt_hi, locale),
    seo_title: pickNullable(post.seo_title, post.seo_title_hi, locale),
    seo_description: pickNullable(post.seo_description, post.seo_description_hi, locale),
    cover_image_alt: pickNullable(post.cover_image_alt, post.cover_image_alt_hi, locale),
    category: post.category ? localizeTaxonomy(post.category, locale) : null,
    tags: post.tags.map((t) => localizeTaxonomy(t, locale)),
    translated: Boolean(post.title_hi?.trim()),
  };
}

/** Article body: Hindi when available. `fallback` is true when English is shown on a Hindi page. */
export function localizeContent(content: string, contentHi: string | null | undefined, locale: Locale) {
  const useHindi = locale === "hi" && Boolean(contentHi?.trim());
  return { body: useHindi ? contentHi! : content, fallback: locale === "hi" && !useHindi };
}
