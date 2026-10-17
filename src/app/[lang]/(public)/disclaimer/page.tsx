import type { Metadata } from "next";
import { getSiteProfile } from "@/lib/content";
import { fmt, languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, href } = await getI18n();
  return {
    title: t.disclaimer.meta.title,
    description: t.disclaimer.meta.description,
    alternates: { ...languageAlternates("/disclaimer"), canonical: href("/disclaimer") },
  };
}

export default async function DisclaimerPage() {
  const { t: dict } = await getI18n();
  const t = dict.disclaimer;
  const profile = await getSiteProfile();
  const contact = profile.contact_email ?? t.contactFallback;
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold text-primary">{t.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{t.updated}</p>
      <div className="prose-content mt-8">
        <p>{t.intro}</p>
        <aside className="my-8 rounded-lg border-l-4 border-teal bg-muted/50 px-5 py-4">
          <p className="!mt-0 font-semibold text-foreground">{t.summaryHeading}</p>
          <ul className="!mb-0">
            {t.summary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
        {t.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((p) => (
              <p key={p}>{fmt(p, { contact })}</p>
            ))}
            {section.items.length ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
