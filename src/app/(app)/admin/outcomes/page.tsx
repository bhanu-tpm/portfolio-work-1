import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { cn } from "cn";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, outcomeStatusMeta } from "@/lib/format";
import type { OutcomeStatus } from "@/lib/db/types";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Outcomes" };

const FILTERS: { key: string; label: string; statuses: OutcomeStatus[] }[] = [
  { key: "queue", label: "Approval queue", statuses: ["draft", "approved"] },
  { key: "published", label: "Published", statuses: ["published"] },
  { key: "history", label: "Superseded and archived", statuses: ["superseded", "archived"] },
];

type Row = {
  id: string;
  title: string;
  status: OutcomeStatus;
  updated_at: string;
  request: { reference_code: string; full_name: string } | null;
};

export default async function AdminOutcomesPage({ searchParams }: PageProps<"/admin/outcomes">) {
  await requireAdmin();
  const { view } = await searchParams;
  const filter = FILTERS.find((f) => f.key === view) ?? FILTERS[0];
  const supabase = await createClient();
  const { data } = await supabase
    .from("consultation_outcomes")
    .select("id, title, status, updated_at, request:consultation_requests(reference_code, full_name)")
    .in("status", filter.statuses)
    .order("updated_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title="Consultation outcomes"
        description="Drafts need your explicit approval and publication before a client can see them. Create outcomes from an accepted request."
      />
      <nav aria-label="Outcome views" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/outcomes?view=${f.key}`}
            aria-current={f.key === filter.key ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-xs ring-1 ring-border",
              f.key === filter.key ? "bg-primary text-primary-foreground ring-primary" : "hover:bg-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="Nothing here"
          description={filter.key === "queue" ? "Open an accepted request and choose “New outcome” to start one." : undefined}
        />
      ) : (
        <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/outcomes/${o.id}`} className="grid gap-1 p-4 hover:bg-muted/50 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium">{o.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.request?.full_name} · {o.request?.reference_code} · updated {formatDateTime(o.updated_at)}
                  </p>
                </div>
                <StatusBadge tone={outcomeStatusMeta[o.status].tone}>{outcomeStatusMeta[o.status].label}</StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
