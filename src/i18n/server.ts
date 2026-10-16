import { lang } from "next/root-params";
import { DEFAULT_LOCALE, isLocale, localePath, type Locale } from "./config";
import { dictionaries } from "./dictionaries";

/** Current locale from the [lang] root segment (Server Components only). */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDictionary() {
  return dictionaries[await getLocale()];
}

/** Locale, dictionary and a locale-aware path builder in one call. */
export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale], href: (path: string) => localePath(locale, path) };
}
