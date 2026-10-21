import Link from "next/link";
import { getSiteProfile } from "@/lib/content";
import { isAiConfigured } from "@/lib/env";
import { localizeProfile } from "@/lib/localize";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { LogoMark } from "@/components/brand/logo-mark";

/** Year the site launched, shown in the copyright line (fixed, so pages stay prerenderable). */
const COPYRIGHT_YEAR = 2026;

const LINK = "text-[oklch(0.95_0.01_80/0.75)] hover:text-[oklch(0.95_0.01_80)]";
const HEADING = "font-medium text-[oklch(0.95_0.01_80)]";

export async function SiteFooter({ siteName }: { siteName: string }) {
  const { locale, t, href } = await getI18n();
  const f = t.common.footer;
  const profile = localizeProfile(await getSiteProfile(), locale);

  const groups = [
    {
      id: "footer-explore",
      heading: f.explore,
      links: [
        { path: "/services", label: f.links.services },
        { path: "/about", label: f.links.about },
        { path: "/blog", label: f.links.blog },
        ...(isAiConfigured() ? [{ path: "/assistant", label: f.links.aiGuidance }] : []),
      ],
    },
    {
      id: "footer-information",
      heading: f.information,
      links: [
        { path: "/contact", label: f.links.contact },
        { path: "/privacy", label: f.links.privacy },
        { path: "/disclaimer", label: f.links.disclaimer },
      ],
    },
  ];

  return (
    <footer className="mt-auto bg-[var(--ink)] text-[oklch(0.95_0.01_80)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2.5 font-heading text-2xl font-semibold">
            <LogoMark className="h-7" />
            {siteName}
          </p>
          <p className="mt-1 text-sm font-medium text-[oklch(0.95_0.01_80/0.9)]">{t.common.tagline}</p>
          <p className="mt-2 max-w-xs text-sm text-[oklch(0.95_0.01_80/0.7)]">{f.description}</p>
          <p className="mt-2 text-sm font-medium text-[var(--brand-sun)]">{f.founded}</p>
        </div>
        <div className="grid grid-cols-2 content-start gap-6 text-sm">
          {groups.map((g) => (
            <nav key={g.id} aria-labelledby={g.id} className="space-y-2.5">
              <p id={g.id} className={HEADING}>
                {g.heading}
              </p>
              {g.links.map((l) => (
                <Link key={l.path} href={href(l.path)} className={`block ${LINK}`}>
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="space-y-1.5 text-sm text-[oklch(0.95_0.01_80/0.75)]">
          <p className={HEADING}>{f.connect}</p>
          <p>{f.nextStep}</p>
          {profile.contact_email ? (
            <p>
              <a href={`mailto:${profile.contact_email}`} className="text-[var(--brand-sun)] hover:underline">
                {profile.contact_email}
              </a>
            </p>
          ) : null}
          {profile.contact_phone ? <p>{profile.contact_phone}</p> : null}
          <p>{f.location}</p>
          {profile.social_links.length ? (
            <p className="flex flex-wrap gap-3 pt-1">
              {profile.social_links.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-[oklch(0.95_0.01_80)]">
                  {s.label}
                </a>
              ))}
            </p>
          ) : null}
          <p className="pt-2">
            <Link href="/dashboard/requests/new" className="font-medium text-[oklch(0.95_0.01_80)] underline underline-offset-4 hover:text-[var(--brand-sun)]">
              {f.book} →
            </Link>
          </p>
        </div>
      </div>
      <div className="border-t border-[oklch(0.95_0.01_80/0.1)]">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-[oklch(0.95_0.01_80/0.55)] sm:px-6">
          {fmt(f.rights, { year: COPYRIGHT_YEAR, site: siteName })}
        </p>
      </div>
    </footer>
  );
}
