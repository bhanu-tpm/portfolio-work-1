import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Search } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, requestStatusMeta } from "@/lib/format";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/db/types";
import { pageRange, parsePage, sanitizeSearchTerm } from "@/lib/search";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Requests" };

const PAGE_SIZE = 20;

type Row = {
  id: string;
  reference_code: string;
  full_name: string;
  email: string;
  status: RequestStatus;
  submitted_at: string;
  consent_ai: boolean;
  category: { title: string } | null;
};

export default async function AdminRequestsPage({ searchParams }: PageProps<"/admin/requests">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = REQUEST_STATUSES.includes(sp.status as RequestStatus) ? (sp.status as RequestStatus) : undefined;
  const q = sanitizeSearchTerm(sp.q);
  const page = parsePage(sp.page);

  const supabase = await createClient();
  let query = supabase
    .from("consultation_requests")
    .select("id, reference_code, full_name, email, status, submitted_at, consent_ai, category:consultation_categories(title)", {
      count: "exact",
    })
    .order("submitted_at", { ascending: false })
    .range(...pageRange(page, PAGE_SIZE));
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`reference_code.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const href = (next: { status?: string; page?: number }) => {
    const p = new URLSearchParams();
    const s = next.status === undefined ? status : next.status;
    if (s) p.set("status", s);
    if (q) p.set("q", q);
    if (next.page && next.page > 1) p.set("page", String(next.page));
    const str = p.toString();
    return str ? `/admin/requests?${str}` : "/admin/requests";
  };

  return (
    <>
      <PageHeader title="Consultation requests" description="Review, clarify, accept or decline incoming requests." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {[undefined, ...REQUEST_STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={href({ status: s ?? "", page: 1 })}
              aria-current={status === s ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1 text-xs ring-1 ring-border",
                status === s ? "bg-primary text-primary-foreground ring-primary" : "hover:bg-muted",
              )}
            >
              {s ? requestStatusMeta[s].label : "All"}
            </Link>
          ))}
        </nav>
        <form role="search" className="flex gap-2 lg:w-80">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="q" className="sr-only">
            Search requests
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="Reference, name or email" />
          <Button type="submit" variant="outline" size="icon-lg" aria-label="Search">
            <Search />
          </Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No requests found" description={q || status ? "Try a different filter." : "New requests will appear here."} />
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <ul className="divide-y">
            {rows.map((r) => {
              const meta = requestStatusMeta[r.status];
              return (
                <li key={r.id}>
                  <Link href={`/admin/requests/${r.id}`} className="grid gap-1 p-4 hover:bg-muted/50 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {r.full_name} <span className="font-normal text-muted-foreground">· {r.category?.title ?? "—"}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.reference_code} · {r.email} · {formatDateTime(r.submitted_at)}
                        {r.consent_ai ? "" : " · AI not permitted"}
                      </p>
                    </div>
                    <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <Button asChild variant="outline" size="sm" aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={href({ page: page - 1 })}>Previous</Link>
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button asChild variant="outline" size="sm" aria-disabled={page >= totalPages} className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
            <Link href={href({ page: page + 1 })}>Next</Link>
          </Button>
        </nav>
      ) : null}
    </>
  );
}
