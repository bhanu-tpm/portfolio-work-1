import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";
import { getI18n } from "@/i18n/server";
import { isAiConfigured } from "@/lib/env";
import type { Dictionary } from "@/i18n/dictionaries";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";

export const PUBLIC_NAV: { path: string; key: keyof Dictionary["common"]["nav"] }[] = [
  { path: "/services", key: "services" },
  { path: "/portfolio", key: "portfolio" },
  { path: "/blog", key: "blog" },
  { path: "/assistant", key: "aiGuidance" },
  { path: "/contact", key: "contact" },
];

/** PUBLIC_NAV without the AI guidance link while AI is switched off (AI_ENABLED=false or no API key). */
export function publicNav() {
  return isAiConfigured() ? PUBLIC_NAV : PUBLIC_NAV.filter((item) => item.path !== "/assistant");
}

export async function SiteHeader({ siteName }: { siteName: string }) {
  const { t, href } = await getI18n();
  const items = publicNav().map((item) => ({ href: href(item.path), label: t.common.nav[item.key] }));
  const labels = { signIn: t.common.header.signIn, dashboard: t.common.header.dashboard, admin: t.common.header.admin };
  return (
    <header className="header-scroll sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href={href("/")} className="flex shrink-0 items-center gap-2 font-heading text-xl font-semibold text-foreground">
          <span aria-hidden className="blob-a size-5 bg-primary" />
          {siteName}
        </Link>
        <nav aria-label={t.common.header.mainNav} className="hidden items-center gap-1 lg:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <Suspense fallback={<AccountLinks signedIn={false} isAdmin={false} labels={labels} signInHref={href("/login")} />}>
            <AccountArea labels={labels} signInHref={href("/login")} />
          </Suspense>
          <Button asChild size="lg" className="btn-lift hidden rounded-full px-5 xl:inline-flex">
            <Link href="/dashboard/requests/new">{t.common.header.book}</Link>
          </Button>
          <MobileNav items={items} />
        </div>
      </div>
    </header>
  );
}

type Labels = { signIn: string; dashboard: string; admin: string };

async function AccountArea({ labels, signInHref }: { labels: Labels; signInHref: string }) {
  const user = await getCurrentUser().catch(() => null);
  return <AccountLinks signedIn={Boolean(user)} isAdmin={Boolean(user?.isAdmin)} labels={labels} signInHref={signInHref} />;
}

function AccountLinks({
  signedIn,
  isAdmin,
  labels,
  signInHref,
}: {
  signedIn: boolean;
  isAdmin: boolean;
  labels: Labels;
  signInHref: string;
}) {
  if (!signedIn) {
    return (
      <Button asChild variant="ghost" size="lg">
        <Link href={signInHref}>{labels.signIn}</Link>
      </Button>
    );
  }
  return (
    <Button asChild variant="ghost" size="lg">
      <Link href={isAdmin ? "/admin" : "/dashboard"}>{isAdmin ? labels.admin : labels.dashboard}</Link>
    </Button>
  );
}
