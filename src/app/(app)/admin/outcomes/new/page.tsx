import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageHeader, Section } from "@/components/shared/page";
import { NewOutcomeForm } from "./new-outcome-form";

export const metadata: Metadata = { title: "New outcome" };

export default async function NewOutcomePage({ searchParams }: PageProps<"/admin/outcomes/new">) {
  await requireAdmin();
  const { request: requestId } = await searchParams;
  if (typeof requestId !== "string") notFound();
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("consultation_requests")
    .select("id, reference_code, full_name, category:consultation_categories(title)")
    .eq("id", requestId)
    .maybeSingle<{ id: string; reference_code: string; full_name: string; category: { title: string } | null }>();
  if (!request) notFound();
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, starts_at, timezone, status")
    .eq("request_id", request.id)
    .order("starts_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={request.reference_code} title="New consultation outcome" description={`For ${request.full_name}`} />
      <Section title="Details">
        <NewOutcomeForm
          requestId={request.id}
          defaultTitle={`${request.category?.title ?? "Consultation"} — summary and action plan`}
          appointments={(appointments ?? []).map((a) => ({
            value: a.id,
            label: `${formatDateTime(a.starts_at, a.timezone)} (${a.status})`,
          }))}
        />
      </Section>
    </div>
  );
}
