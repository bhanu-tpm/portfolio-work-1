import type { NextRequest } from "next/server";
import { getPublishedPosts } from "@/lib/content";
import { escapeHtml } from "@/lib/email/template";
import { localizePost } from "@/lib/localize";
import { DEFAULT_LOCALE, LOCALE_TAGS, fmt, isLocale, localePath } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";

// Route handlers can't use next/root-params, so the locale comes from the [lang] param.
export async function GET(_request: NextRequest, { params }: RouteContext<"/[lang]/blog/rss.xml">) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const t = dictionaries[locale].blog.rss;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const name = process.env.NEXT_PUBLIC_SITE_NAME || "Margith";
  const url = (path: string) => `${site}${localePath(locale, path)}`;
  const posts = (await getPublishedPosts()).map((p) => localizePost(p, locale));
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `<item>
  <title>${escapeHtml(p.title)}</title>
  <link>${url(`/blog/${p.slug}`)}</link>
  <guid>${url(`/blog/${p.slug}`)}</guid>
  ${p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ""}
  <description>${escapeHtml(p.excerpt)}</description>
</item>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${escapeHtml(fmt(t.title, { site: name }))}</title>
<link>${url("/blog")}</link>
<description>${escapeHtml(t.description)}</description>
<language>${LOCALE_TAGS[locale]}</language>
${items}
</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
