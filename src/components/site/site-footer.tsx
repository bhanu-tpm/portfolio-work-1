import Link from "next/link";
import { getSiteProfile } from "@/lib/content";
import { localizeProfile } from "@/lib/localize";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { PUBLIC_NAV } from "./site-header";

export async function SiteFooter({ siteName }: { siteName: string }) {
  const { locale, t, href } = await getI18n();
  const profile = localizeProfile(await getSiteProfile(), locale);
  const hasContact = Boolean(
    profile.contact_email || profile.contact_phone || profile.location || profile.social_links.length,
  );
  return (
    <footer className="mt-auto bg-[var(--ink)] text-[oklch(0.95_0.01_80)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="font-heading text-2xl font-semibold">{siteName}</p>
          <p className="mt-2 max-w-xs text-sm text-[oklch(0.95_0.01_80/0.7)]">{profile.headline}</p>
        </div>
        <nav aria-label={t.common.footer.nav} className="grid grid-cols-2 content-start gap-2.5 text-sm">
          {PUBLIC_NAV.map((item) => (
            <Link key={item.path} href={href(item.path)} className="text-[oklch(0.95_0.01_80/0.75)] hover:text-[oklch(0.95_0.01_80)]">
              {t.common.nav[item.key]}
            </Link>
          ))}
          <Link href={href("/privacy")} className="text-[oklch(0.95_0.01_80/0.75)] hover:text-[oklch(0.95_0.01_80)]">
            {t.common.nav.privacy}
          </Link>
        </nav>
        <div className="space-y-1.5 text-sm text-[oklch(0.95_0.01_80/0.75)]">
          {hasContact ? <p className="font-medium text-[oklch(0.95_0.01_80)]">{t.common.footer.sayHello}</p> : null}
          {profile.contact_email ? (
            <p>
              <a href={`mailto:${profile.contact_email}`} className="hover:text-[oklch(0.95_0.01_80)]">
                {profile.contact_email}
              </a>
            </p>
          ) : null}
          {profile.contact_phone ? <p>{profile.contact_phone}</p> : null}
          {profile.location ? <p>{profile.location}</p> : null}
          {profile.social_links.length ? (
            <p className="flex flex-wrap gap-3 pt-1">
              {profile.social_links.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-[oklch(0.95_0.01_80)]">
                  {s.label}
                </a>
              ))}
            </p>
          ) : null}
        </div>
      </div>
      <div className="border-t border-[oklch(0.95_0.01_80/0.1)]">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-[oklch(0.95_0.01_80/0.55)] sm:px-6">
          {fmt(t.common.footer.rights, { site: siteName })}
        </p>
      </div>
    </footer>
  );
}
