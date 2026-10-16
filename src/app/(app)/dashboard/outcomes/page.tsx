import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate, outcomeStatusMeta } from "@/lib/format";
import type { OutcomeStatus } from "@/lib/db/types";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Consultation outcomes" };

type Row = {
  id: string;
  title: string;
  status: OutcomeStatus;
  published_at: string | null;
  request: { reference_code: string } | null;
};

export default async function MyOutcomesPage() {
  const user = await requireUser("/dashboard/outcomes");
  const supabase = await createClient();
  const { data } = await supabase
    .from("consultation_outcomes")
    .select("id, title, status, published_at, request:consultation_requests(reference_code)")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title="Consultation outcomes"
        description="Your written summaries and action plans appear here once the consultant has reviewed and published them."
      />
      {rows.length === 0 ? (
        <EmptyState icon={FileCheck2} title="No outcomes yet" description="After your consultation, your personalised action plan will be published here." />
      ) : (
        <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
          {rows.map((o) => {
            const meta = outcomeStatusMeta[o.status];
            const available = o.status === "published" || o.status === "superseded";
            return (
              <li key={o.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{o.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.request?.reference_code}
                    {o.published_at ? ` · Published ${formatDate(o.published_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={available ? (o.status === "published" ? "success" : "neutral") : "info"}>{meta.clientLabel}</StatusBadge>
                  {available ? (
                    <>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/outcomes/${o.id}`}>View</Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost" aria-label={`Download ${o.title}`}>
                        <a href={`/api/outcomes/${o.id}/download`}>
                          <Download />
                        </a>
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
