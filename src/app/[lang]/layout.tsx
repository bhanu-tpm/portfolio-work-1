import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n/provider";
import { LOCALES, LOCALE_TAGS, fmt, isLocale } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";
import { fontVariables } from "../fonts";
import "../globals.css";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Career Consultation";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ lang: locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await lang();
  const t = dictionaries[isLocale(locale) ? locale : "en"].common;
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    title: { default: fmt(t.meta.title, { site: siteName }), template: `%s · ${siteName}` },
    description: t.meta.description,
    openGraph: { type: "website", siteName, locale: isLocale(locale) ? LOCALE_TAGS[locale].replace("-", "_") : "en_IN" },
  };
}

export const viewport: Viewport = {
  themeColor: "#fbf6ee",
  width: "device-width",
  initialScale: 1,
};

/** Root layout for the public, localised site (/ and /hi/...). */
export default async function LocaleRootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await lang();
  if (!isLocale(locale)) notFound();
  const t = dictionaries[locale].common;
  return (
    <html lang={LOCALE_TAGS[locale]} className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t.header.skipToContent}
        </a>
        <I18nProvider locale={locale}>
          <TooltipProvider>{children}</TooltipProvider>
        </I18nProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
