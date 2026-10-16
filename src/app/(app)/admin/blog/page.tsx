import type { Metadata } from "next";
import Link from "next/link";
import Form from "next/form";
import { FileText, FolderTree, Plus, Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate, postStatusMeta } from "@/lib/format";
import type { PostStatus } from "@/lib/db/types";
import { POST_STATUS_FILTERS, pageCount, pageRange, sanitizeSearch } from "@/lib/validation/content";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListPager } from "@/components/content-admin/list-pager";
import { hasHindiText } from "@/components/content-admin/hindi-text";

export const metadata: Metadata = { title: "Blog" };

type Row = {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  published_at: string | null;
  updated_at: string;
  reading_minutes: number;
  title_hi: string | null;
  content_hi: string | null;
  category: { name: string } | null;
};

export default async function AdminBlogPage({ searchParams }: PageProps<"/admin/blog">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sanitizeSearch(sp.q);
  const statusParam = typeof sp.status === "string" ? sp.status : "all";
  const status = (POST_STATUS_FILTERS as readonly string[]).includes(statusParam) ? statusParam : "all";
  const { page, from, to } = pageRange(sp.page);

  const supabase = await createClient();
  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, status, published_at, updated_at, reading_minutes, title_hi, content_hi, category:blog_categories(name)", {
      count: "exact",
    })
    .order("updated_at", { ascending: false })
    .range(from, to);
  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  const { data, count, error } = await query;
  const posts = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const filtered = Boolean(q) || status !== "all" || page > 1;

  return (
    <>
      <PageHeader
        title="Blog"
        description="Write, publish and manage articles. Only published posts are visible on the public blog."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/blog/categories">
                <FolderTree data-icon="inline-start" aria-hidden /> Categories
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/blog/new">
                <Plus data-icon="inline-start" aria-hidden /> New post
              </Link>
            </Button>
          </>
        }
      />

      {sp.deleted ? (
        <Alert className="mb-4" role="status">
          <AlertDescription>Post deleted.</AlertDescription>
        </Alert>
      ) : null}

      <Form
        action="/admin/blog"
        className="mb-4 grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        role="search"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="blog-q">Search</Label>
          <Input id="blog-q" name="q" defaultValue={q} placeholder="Title or slug" maxLength={100} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="blog-status">Status</Label>
          <select
            id="blog-status"
            name="status"
            defaultValue={status}
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="h-9 flex-1 sm:flex-none">
            <Search data-icon="inline-start" aria-hidden /> Filter
          </Button>
          {filtered ? (
            <Button asChild variant="ghost" className="h-9">
              <Link href="/admin/blog">Clear</Link>
            </Button>
          ) : null}
        </div>
      </Form>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>Posts could not be loaded. Please refresh the page.</AlertDescription>
        </Alert>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filtered ? "No posts match these filters" : "No posts yet"}
          description={filtered ? "Try a different search or status." : "Write your first article to share practical career advice."}
          action={
            filtered ? (
              <Button asChild variant="outline">
                <Link href="/admin/blog">Clear filters</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/admin/blog/new">Write a post</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
            {posts.map((p) => {
              const meta = postStatusMeta[p.status];
              return (
                <li key={p.id}>
                  <Link
                    href={`/admin/blog/${p.id}`}
                    className="flex flex-col gap-2 p-4 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        /{p.slug} · {p.category?.name ?? "Uncategorised"} · {p.reading_minutes} min read ·{" "}
                        {p.published_at ? `Published ${formatDate(p.published_at)}` : `Updated ${formatDate(p.updated_at)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <HindiStatusBadge titleHi={p.title_hi} contentHi={p.content_hi} />
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <ListPager
            basePath="/admin/blog"
            params={{ q: q || undefined, status: status === "all" ? undefined : status }}
            page={page}
            pageCount={pageCount(total)}
            total={total}
          />
        </>
      )}
    </>
  );
}

function HindiStatusBadge({ titleHi, contentHi }: { titleHi: string | null; contentHi: string | null }) {
  const title = hasHindiText(titleHi);
  const content = hasHindiText(contentHi);
  if (title && content) {
    return (
      <StatusBadge tone="success">
        <span lang="hi">हिंदी</span> ✓<span className="sr-only"> (Hindi translation available)</span>
      </StatusBadge>
    );
  }
  if (title || content) {
    return (
      <StatusBadge tone="warning">
        Hindi partial<span className="sr-only">: {title ? "content" : "title"} not translated</span>
      </StatusBadge>
    );
  }
  return <StatusBadge tone="neutral">No Hindi</StatusBadge>;
}
