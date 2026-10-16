"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Languages } from "lucide-react";
import { cn } from "cn";
import { LOCALES, LOCALE_LABELS, fmt, localePath, splitLocale, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

function Options({ path, className }: { path: string; className?: string }) {
  const { locale, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t.common.header.language}
      className={cn("inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5 text-sm", className)}
    >
      <Languages className="mx-1.5 size-4 text-muted-foreground" aria-hidden />
      {LOCALES.map((l: Locale) => {
        const current = l === locale;
        return (
          <Link
            key={l}
            href={localePath(l, path)}
            hrefLang={l}
            lang={l}
            aria-current={current ? "true" : undefined}
            aria-label={current ? LOCALE_LABELS[l] : fmt(t.common.header.switchTo, { language: LOCALE_LABELS[l] })}
            prefetch={false}
            className={cn(
              "rounded-full px-2.5 py-1 font-medium transition-colors",
              current ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LOCALE_LABELS[l]}
          </Link>
        );
      })}
    </div>
  );
}

function CurrentPathOptions({ className }: { className?: string }) {
  // usePathname returns the browser URL (/hi/blog), not the internal rewrite.
  const { path } = splitLocale(usePathname());
  return <Options path={path} className={className} />;
}

/** English | हिंदी toggle that keeps the visitor on the same page. */
export function LanguageSwitcher({ className }: { className?: string }) {
  return (
    <Suspense fallback={<Options path="/" className={className} />}>
      <CurrentPathOptions className={className} />
    </Suspense>
  );
}
