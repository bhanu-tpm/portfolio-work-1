import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/content";
import { LOCALES, localePath } from "@/i18n/config";

/** Every public page in English and Hindi, each entry listing its language alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const posts = await getPublishedPosts();
  const paths = [
    ...["/", "/services", "/portfolio", "/blog", "/contact", "/assistant", "/privacy"].map((path) => ({
      path,
      lastModified: undefined as string | undefined,
    })),
    ...posts.map((p) => ({ path: `/blog/${p.slug}`, lastModified: p.updated_at })),
  ];
  return paths.flatMap(({ path, lastModified }) =>
    LOCALES.map((locale) => ({
      url: `${base}${localePath(locale, path)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}${localePath(l, path)}`])),
      },
    })),
  );
}
