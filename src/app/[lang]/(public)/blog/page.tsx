import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterPosts, getBlogCategories, getPublishedPosts } from "@/lib/content";
import { localizePost, localizeTaxonomy } from "@/lib/localize";
import { PostCard } from "@/components/site/post-card";
import { EmptyState, LoadingBlock } from "@/components/shared/page";
import { languageAlternates } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t, href } = await getI18n();
  return {
    title: t.blog.meta.title,
    description: t.blog.meta.description,
    alternates: {
      ...languageAlternates("/blog"),
      canonical: href("/blog"),
      types: { "application/rss+xml": href("/blog/rss.xml") },
    },
  };
}

export default async function BlogPage({ searchParams }: PageProps<"/[lang]/blog">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold text-primary">{t.blog.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{t.blog.intro}</p>
      <Suspense fallback={<LoadingBlock label={t.blog.loading} />}>
        <BlogResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BlogResults({ searchParams }: { searchParams: PageProps<"/[lang]/blog">["searchParams"] }) {
  const { locale, t: dict, href: localeHref } = await getI18n();
  const t = dict.blog;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const category = typeof params.category === "string" ? params.category : "";
  const tag = typeof params.tag === "string" ? params.tag : "";
  const [posts, rawCategories] = await Promise.all([getPublishedPosts(), getBlogCategories()]);
  const categories = rawCategories.map((c) => localizeTaxonomy(c, locale));
  // Search matches the English text and, on Hindi pages, the Hindi text as well.
  const matched = new Set(filterPosts(posts, { q, category, tag }).map((p) => p.id));
  if (locale !== "en") {
    const localized = posts.map((p) => localizePost(p, locale));
    for (const p of filterPosts(localized, { q, category, tag })) matched.add(p.id);
  }
  const results = posts.filter((p) => matched.has(p.id));

  const href = (next: { category?: string }) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (next.category) sp.set("category", next.category);
    const s = sp.toString();
    return localeHref(s ? `/blog?${s}` : "/blog");
  };

  return (
    <>
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label={t.categories} className="flex flex-wrap gap-2">
          {[{ slug: "", name: t.all }, ...categories].map((c) => (
            <Link
              key={c.slug || "all"}
              href={href({ category: c.slug })}
              aria-current={category === c.slug ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm ring-1 ring-border transition-colors",
                category === c.slug ? "bg-primary text-primary-foreground ring-primary" : "hover:bg-muted",
              )}
            >
              {c.name}
            </Link>
          ))}
        </nav>
        <form role="search" action={localeHref("/blog")} className="flex w-full gap-2 lg:w-80">
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <label htmlFor="blog-search" className="sr-only">
            {t.searchLabel}
          </label>
          <Input id="blog-search" name="q" defaultValue={q} placeholder={t.searchPlaceholder} className="h-9" />
          <Button type="submit" variant="outline" size="icon-lg" aria-label={t.search}>
            <Search />
          </Button>
        </form>
      </div>

      {tag ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {t.taggedBefore}
          <strong>{tag}</strong>
          {t.taggedAfter}{" "}
          <Link href={localeHref("/blog")} className="text-teal underline">
            {t.clear}
          </Link>
        </p>
      ) : null}

      {results.length ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-8"
          icon={Search}
          title={q || category || tag ? t.noMatchTitle : t.emptyTitle}
          description={q || category || tag ? t.noMatchBody : t.emptyBody}
        />
      )}
    </>
  );
}
