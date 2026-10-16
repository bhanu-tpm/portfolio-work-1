export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = { en: "English", hi: "हिंदी" };
/** BCP 47 tags for Intl date formatting and <html lang>. */
export const LOCALE_TAGS: Record<Locale, string> = { en: "en-IN", hi: "hi-IN" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Builds a public URL for a locale. English lives at the unprefixed path
 * (/services), Hindi under /hi (/hi/services). Non-public paths such as
 * /dashboard are returned unchanged.
 */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE || isAppPath(clean)) return clean;
  return clean === "/" ? "/hi" : `/hi${clean}`;
}

/** Strips a locale prefix from a browser path: /hi/blog -> { locale: "hi", path: "/blog" }. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  if (pathname === "/hi" || pathname.startsWith("/hi/")) {
    return { locale: "hi", path: pathname.slice(3) || "/" };
  }
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}

/** Areas that are not localised (always English, own root layout). */
const APP_PREFIXES = ["/dashboard", "/admin", "/api", "/auth/confirm"];
export function isAppPath(path: string) {
  return APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

/** Simple "{name}" placeholder interpolation for dictionary strings. */
export function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

/** hreflang alternates for a public path. */
export function languageAlternates(path: string) {
  return {
    canonical: path,
    languages: { en: localePath("en", path), hi: localePath("hi", path), "x-default": localePath("en", path) },
  };
}
