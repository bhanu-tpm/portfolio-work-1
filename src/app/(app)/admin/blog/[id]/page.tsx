import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { BlogCategory, BlogPost } from "@/lib/db/types";
import { uuid } from "@/lib/validation/common";
import { PageHeader } from "@/components/shared/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PostEditor } from "../post-editor";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({ params, searchParams }: PageProps<"/admin/blog/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: post }, { data: cats }, { data: tagRows }] = await Promise.all([
    supabase.from("blog_posts").select("*").eq("id", id).maybeSingle<BlogPost>(),
    supabase.from("blog_categories").select("id, slug, name").order("name"),
    supabase.from("blog_post_tags").select("tag:blog_tags(name)").eq("post_id", id),
  ]);
  if (!post) notFound();
  const tags = ((tagRows ?? []) as unknown as { tag: { name: string } | null }[])
    .map((t) => t.tag?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Edit post"
        description={post.title}
        actions={
          <Button asChild variant="ghost">
            <Link href="/admin/blog">
              <ArrowLeft data-icon="inline-start" aria-hidden /> All posts
            </Link>
          </Button>
        }
      />
      {created ? (
        <Alert className="mb-4" role="status">
          <AlertDescription>Post created.</AlertDescription>
        </Alert>
      ) : null}
      <PostEditor post={post} tags={tags} categories={(cats ?? []) as BlogCategory[]} />
    </div>
  );
}
