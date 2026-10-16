import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "New category" };

export default async function NewCategoryPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New consultation category"
        actions={
          <Button asChild variant="ghost">
            <Link href="/admin/categories">
              <ArrowLeft data-icon="inline-start" aria-hidden /> All categories
            </Link>
          </Button>
        }
      />
      <CategoryForm />
    </div>
  );
}
