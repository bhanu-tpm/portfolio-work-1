import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FolderTree, Tags } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader, Section } from "@/components/shared/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { HINDI_HINT } from "@/components/content-admin/hindi-text";
import { BlogCategoryForm, BlogTagHindiForm } from "./category-forms";

export const metadata: Metadata = { title: "Blog categories" };

const MAX_LISTED_TAGS = 200;

export default async function BlogCategoriesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data, error }, { data: tagData, error: tagError }] = await Promise.all([
    supabase.from("blog_categories").select("id, slug, name, name_hi, blog_posts(count)").order("name"),
    supabase.from("blog_tags").select("id, slug, name, name_hi, blog_post_tags(count)").order("name").limit(MAX_LISTED_TAGS),
  ]);
  const categories = ((data ?? []) as unknown as {
    id: string;
    slug: string;
    name: string;
    name_hi: string | null;
    blog_posts: { count: number }[];
  }[]).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    name_hi: c.name_hi,
    post_count: c.blog_posts?.[0]?.count ?? 0,
  }));
  const tags = ((tagData ?? []) as unknown as {
    id: string;
    slug: string;
    name: string;
    name_hi: string | null;
    blog_post_tags: { count: number }[];
  }[]).map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    name_hi: t.name_hi,
    post_count: t.blog_post_tags?.[0]?.count ?? 0,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Blog categories"
        description="Group posts into a few broad topics. Deleting a category keeps its posts (they become uncategorised)."
        actions={
          <Button asChild variant="ghost">
            <Link href="/admin/blog">
              <ArrowLeft data-icon="inline-start" aria-hidden /> All posts
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6">
        <Section title="Add a category">
          <BlogCategoryForm />
        </Section>
        <Section title="Existing categories">
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>Categories could not be loaded. Please refresh the page.</AlertDescription>
            </Alert>
          ) : categories.length === 0 ? (
            <EmptyState icon={FolderTree} title="No categories yet" description="Add your first category above." />
          ) : (
            <ul className="divide-y">
              {categories.map((c) => (
                <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {c.post_count} post{c.post_count === 1 ? "" : "s"}
                  </p>
                  <BlogCategoryForm key={`${c.name}-${c.slug}-${c.name_hi ?? ""}`} category={c} />
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section
          title="Tags"
          description={`Tags are created from the post editor. Optionally add a Hindi name for each tag. ${HINDI_HINT}`}
        >
          {tagError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>Tags could not be loaded. Please refresh the page.</AlertDescription>
            </Alert>
          ) : tags.length === 0 ? (
            <EmptyState icon={Tags} title="No tags yet" description="Add tags to a post and they will appear here." />
          ) : (
            <>
              <ul className="divide-y">
                {tags.map((t) => (
                  <li key={t.id} className="py-3 first:pt-0 last:pb-0">
                    <BlogTagHindiForm key={t.name_hi ?? ""} tag={t} />
                  </li>
                ))}
              </ul>
              {tags.length >= MAX_LISTED_TAGS ? (
                <p className="mt-3 text-xs text-muted-foreground">Showing the first {MAX_LISTED_TAGS} tags (A–Z).</p>
              ) : null}
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
