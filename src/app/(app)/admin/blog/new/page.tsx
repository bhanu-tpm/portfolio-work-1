import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { BlogCategory } from "@/lib/db/types";
import { PageHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { PostEditor } from "../post-editor";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("blog_categories").select("id, slug, name").order("name");
  const categories = (data ?? []) as BlogCategory[];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="New post"
        description="Drafts are private until you publish them."
        actions={
          <Button asChild variant="ghost">
            <Link href="/admin/blog">
              <ArrowLeft data-icon="inline-start" aria-hidden /> All posts
            </Link>
          </Button>
        }
      />
      <PostEditor categories={categories} />
    </div>
  );
}
