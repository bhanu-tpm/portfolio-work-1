import type { Metadata } from "next";
import { getSiteProfile } from "@/lib/content";
import { fmt, languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { env } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const { t, href } = await getI18n();
  return {
    title: t.privacy.meta.title,
    description: t.privacy.meta.description,
    alternates: { ...languageAlternates("/privacy"), canonical: href("/privacy") },
  };
}

export default async function PrivacyPage() {
  const { t: dict } = await getI18n();
  const t = dict.privacy;
  const profile = await getSiteProfile();
  const contact = profile.contact_email ?? t.contactFallback;
  const provider = t.aiProviders[env.aiProvider()];
  const values = { contact, provider: provider.name, providerTerms: provider.terms };
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold text-primary">{t.title}</h1>
      <div className="prose-content mt-8">
        <p>{t.intro}</p>
        {t.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((p) => (
              <p key={p}>{fmt(p, values)}</p>
            ))}
            {section.items.length ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{fmt(item, values)}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
