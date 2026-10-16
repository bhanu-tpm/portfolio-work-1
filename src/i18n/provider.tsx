"use client";

import { createContext, use } from "react";
import { DEFAULT_LOCALE, localePath, type Locale } from "./config";
import { dictionaries, type Dictionary } from "./dictionaries";

const I18nContext = createContext<Locale>(DEFAULT_LOCALE);

/** Makes the current locale available to Client Components under [lang]. */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext value={locale}>{children}</I18nContext>;
}

export function useI18n(): { locale: Locale; t: Dictionary; href: (path: string) => string } {
  const locale = use(I18nContext);
  return { locale, t: dictionaries[locale], href: (path: string) => localePath(locale, path) };
}
