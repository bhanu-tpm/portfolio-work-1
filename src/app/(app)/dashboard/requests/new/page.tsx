import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { ConsultationCategory } from "@/lib/db/types";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "New consultation request" };

export default async function NewRequestPage({ searchParams }: PageProps<"/dashboard/requests/new">) {
  const user = await requireUser("/dashboard/requests/new");
  const { category } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("consultation_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  const categories = (data ?? []) as ConsultationCategory[];
  const p = user.profile;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Request a consultation"
        description="Tell me about your situation. I review every request personally and reply within a few working days."
      />
      {categories.length === 0 ? (
        <EmptyState title="Consultations are not open yet" description="No consultation categories are available at the moment." />
      ) : (
        <RequestForm
          categories={categories}
          initialCategoryId={typeof category === "string" ? category : undefined}
          minDate={new Date().toISOString().slice(0, 10)}
          defaults={{
            fullName: p?.full_name ?? "",
            email: p?.email ?? user.email,
            phone: p?.phone ?? "",
            educationStatus: p?.education_status ?? "",
            organization: p?.organization ?? "",
            course: p?.course ?? "",
          }}
        />
      )}
    </div>
  );
}
