import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, LayoutGrid, Pencil, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { ConsultationCategory } from "@/lib/db/types";
import { formatLabel } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InlineActionForm } from "@/components/content-admin/action-forms";
import { moveCategory, setCategoryActive } from "./actions";

export const metadata: Metadata = { title: "Consultation categories" };

export default async function AdminCategoriesPage({ searchParams }: PageProps<"/admin/categories">) {
  await requireAdmin();
  const { deleted } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("consultation_categories").select("*").order("sort_order").order("title");
  const categories = (data ?? []) as ConsultationCategory[];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Consultation categories"
        description="The services clients can request. Order here is the order shown on the public site."
        actions={
          <Button asChild>
            <Link href="/admin/categories/new">
              <Plus data-icon="inline-start" aria-hidden /> New category
            </Link>
          </Button>
        }
      />
      {deleted ? (
        <Alert className="mb-4" role="status">
          <AlertDescription>Category deleted.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>Categories could not be loaded. Please refresh the page.</AlertDescription>
        </Alert>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No categories yet"
          description="Clients can't submit requests until at least one active category exists."
          action={
            <Button asChild>
              <Link href="/admin/categories/new">Create a category</Link>
            </Button>
          }
        />
      ) : (
        <ol className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
          {categories.map((c, i) => (
            <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{c.title}</p>
                  <StatusBadge tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "Active" : "Disabled"}</StatusBadge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  /{c.slug} · {c.formats.map(formatLabel).join(", ")}
                  {c.duration_minutes ? ` · ${c.duration_minutes} min` : ""} · {c.intake_questions.length} intake question
                  {c.intake_questions.length === 1 ? "" : "s"}
                  {c.resume_review_enabled ? " · resume review" : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <InlineActionForm
                  action={moveCategory}
                  fields={{ id: c.id, direction: "up" }}
                  label={`Move ${c.title} up`}
                  size="icon-sm"
                  variant="ghost"
                  disabled={i === 0}
                  pendingLabel=""
                >
                  <ArrowUp aria-hidden />
                </InlineActionForm>
                <InlineActionForm
                  action={moveCategory}
                  fields={{ id: c.id, direction: "down" }}
                  label={`Move ${c.title} down`}
                  size="icon-sm"
                  variant="ghost"
                  disabled={i === categories.length - 1}
                  pendingLabel=""
                >
                  <ArrowDown aria-hidden />
                </InlineActionForm>
                <InlineActionForm
                  action={setCategoryActive}
                  fields={{ id: c.id, value: c.is_active ? "false" : "true" }}
                  pendingLabel="Saving…"
                >
                  {c.is_active ? "Disable" : "Enable"}
                </InlineActionForm>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/categories/${c.id}`}>
                    <Pencil aria-hidden /> Edit<span className="sr-only"> {c.title}</span>
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
