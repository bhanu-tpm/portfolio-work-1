import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublishedPost, getPublishedPosts } from "@/lib/content";
import { DEFAULT_TIMEZONE, formatDate } from "@/lib/format";
import { shouldOptimize } from "@/lib/images";
import { localizeContent, localizePost } from "@/lib/localize";
import { Markdown } from "@/components/shared/markdown";
import { LOCALE_TAGS, fmt, languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  // At least one param is required for build-time validation; unknown slugs render on demand.
  return posts.length ? posts.slice(0, 50).map((p) => ({ slug: p.slug })) : [{ slug: "__placeholder__" }];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { locale, t, href } = await getI18n();
  const raw = await getPublishedPost(slug);
  if (!raw) return { title: t.blog.post.notFound };
  const post = localizePost(raw, locale);
  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt;
  const path = `/blog/${post.slug}`;
  return {
    title,
    description,
    alternates: { ...languageAlternates(path), canonical: href(path) },
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: post.published_at ?? undefined,
      images: post.cover_image_url ? [{ url: post.cover_image_url, alt: post.cover_image_alt ?? "" }] : undefined,
    },
  };
}

// The post is resolved before streaming starts so unknown slugs get a real 404 status.
// Known slugs are prerendered by generateStaticParams; the data read is cached.
export default async function BlogPostPage({ params }: PageProps<"/[lang]/blog/[slug]">) {
  const { slug } = await params;
  const raw = await getPublishedPost(slug);
  if (!raw) notFound();
  const { locale, t: dict, href } = await getI18n();
  const t = dict.blog.post;
  const post = localizePost(raw, locale);
  const { body, fallback } = localizeContent(raw.content, raw.content_hi, locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    image: post.cover_image_url ?? undefined,
    inLanguage: LOCALE_TAGS[locale],
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <script
        type="application/ld+json"
        // JSON.stringify output with < escaped cannot break out of the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Button asChild variant="link" className="mb-6 px-0 text-muted-foreground">
        <Link href={href("/blog")}>
          <ArrowLeft data-icon="inline-start" /> {t.allArticles}
        </Link>
      </Button>
      <header>
        <p className="text-sm text-muted-foreground">
          {post.category ? (
            <Link href={href(`/blog?category=${post.category.slug}`)} className="font-medium text-teal hover:underline">
              {post.category.name}
            </Link>
          ) : null}
          {post.category ? " · " : null}
          <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at, DEFAULT_TIMEZONE, LOCALE_TAGS[locale])}</time> ·{" "}
          {fmt(dict.common.readingTime, { n: post.reading_minutes })}
        </p>
        <h1 className="mt-3 text-4xl leading-tight font-semibold text-primary sm:text-5xl" lang={post.translated ? undefined : "en"}>
          {post.title}
        </h1>
        {post.excerpt ? <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p> : null}
      </header>
      {post.cover_image_url ? (
        <Image
          src={post.cover_image_url}
          alt={post.cover_image_alt ?? ""}
          width={1200}
          height={630}
          priority
          unoptimized={!shouldOptimize(post.cover_image_url)}
          className="mt-8 aspect-[1200/630] w-full rounded-xl object-cover"
        />
      ) : null}
      {fallback ? (
        <p role="note" className="mt-8 flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Languages className="size-4 shrink-0" aria-hidden />
          {t.englishOnly}
        </p>
      ) : null}
      <div lang={fallback ? "en" : undefined}>
        <Markdown className="mt-10">{body}</Markdown>
      </div>
      {post.tags.length ? (
        <ul className="mt-10 flex flex-wrap gap-2" aria-label={t.tags}>
          {post.tags.map((tag) => (
            <li key={tag.id}>
              <Link href={href(`/blog?tag=${tag.slug}`)} className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-accent">
                #{tag.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <aside className="mt-14 rounded-2xl bg-secondary/60 p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{t.ctaTitle}</h2>
        <p className="mt-2 text-muted-foreground">{t.ctaBody}</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/requests/new">{t.book}</Link>
        </Button>
      </aside>
    </article>
  );
}
