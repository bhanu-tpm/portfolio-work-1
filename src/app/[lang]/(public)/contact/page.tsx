import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { getSiteProfile } from "@/lib/content";
import { localizeProfile } from "@/lib/localize";
import { languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { ContactForm } from "./contact-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t, href } = await getI18n();
  return {
    title: t.contact.meta.title,
    description: t.contact.meta.description,
    alternates: { ...languageAlternates("/contact"), canonical: href("/contact") },
  };
}

export default async function ContactPage() {
  const { locale, t } = await getI18n();
  const profile = localizeProfile(await getSiteProfile(), locale);
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1.4fr]">
      <div>
        <h1 className="text-4xl font-semibold text-primary">{t.contact.title}</h1>
        <p className="mt-3 text-muted-foreground">{t.contact.intro}</p>
        <ul className="mt-8 space-y-3 text-sm">
          {profile.contact_email ? (
            <li className="flex items-center gap-3">
              <Mail className="size-4 text-teal" aria-hidden />
              <a href={`mailto:${profile.contact_email}`} className="hover:underline">
                {profile.contact_email}
              </a>
            </li>
          ) : null}
          {profile.contact_phone ? (
            <li className="flex items-center gap-3">
              <Phone className="size-4 text-teal" aria-hidden />
              {profile.contact_phone}
            </li>
          ) : null}
          {profile.location ? (
            <li className="flex items-center gap-3">
              <MapPin className="size-4 text-teal" aria-hidden />
              {profile.location}
            </li>
          ) : null}
        </ul>
      </div>
      <ContactForm />
    </div>
  );
}
