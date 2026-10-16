import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { ConsultationCategory } from "@/lib/db/types";
import { uuid } from "@/lib/validation/common";
import { PageHeader } from "@/components/shared/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmActionForm } from "@/components/content-admin/action-forms";
import { deleteCategory } from "../actions";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategoryPage({ params, searchParams }: PageProps<"/admin/categories/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;
  if (!uuid.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: category }, { count }] = await Promise.all([
    supabase.from("consultation_categories").select("*").eq("id", id).maybeSingle<ConsultationCategory>(),
    supabase.from("consultation_requests").select("id", { count: "exact", head: true }).eq("category_id", id),
  ]);
  if (!category) notFound();
  const requestCount = count ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Edit category"
        description={category.title}
        actions={
          <Button asChild variant="ghost">
            <Link href="/admin/categories">
              <ArrowLeft data-icon="inline-start" aria-hidden /> All categories
            </Link>
          </Button>
        }
      />
      {created ? (
        <Alert className="mb-4" role="status">
          <AlertDescription>Category created.</AlertDescription>
        </Alert>
      ) : null}
      <CategoryForm key={category.id} category={category} />

      <section className="mt-6 flex flex-col gap-3 rounded-xl p-4 ring-1 ring-destructive/30 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="font-sans text-base font-semibold tracking-normal">Delete category</h2>
          <p className="text-sm text-muted-foreground">
            {requestCount > 0
              ? `Used by ${requestCount} request(s), so it can't be deleted. Disable it instead (uncheck "Active").`
              : "Not used by any request. Deleting is permanent."}
          </p>
        </div>
        {requestCount === 0 ? (
          <ConfirmActionForm
            action={deleteCategory}
            fields={{ id: category.id }}
            triggerLabel="Delete category"
            triggerIcon={<Trash2 aria-hidden />}
            title="Delete this category?"
            description={`"${category.title}" will be permanently deleted.`}
          />
        ) : null}
      </section>
    </div>
  );
}
