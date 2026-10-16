import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { AuditLog } from "@/lib/db/types";
import { DEFAULT_PAGE_SIZE, pageRange, totalPages } from "@/lib/pagination";
import { compactJson, dateRangeBounds, escapeLike, isUuid, parseAuditFilters } from "@/lib/validation/admin";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { FilterForm, FilterInput, QueryError, TableWrap } from "@/components/admin-ops/filters";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const filters = parseAuditFilters(await searchParams);
  const supabase = await createClient();

  const { from, to } = pageRange(filters.page);
  let query = supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  // Values are allow-listed by parseAuditFilters; LIKE wildcards are escaped.
  if (filters.action) query = query.like("action", `${escapeLike(filters.action)}%`);
  if (filters.entity) query = query.eq("entity_type", filters.entity);
  const bounds = dateRangeBounds(filters.from, filters.to);
  if (bounds.gte) query = query.gte("created_at", bounds.gte);
  if (bounds.lt) query = query.lt("created_at", bounds.lt);

  const { data, count, error } = await query;
  if (error) console.error("[admin/audit] list failed", error.message);
  const rows = (data ?? []) as AuditLog[];

  // actor_id references auth.users (no PostgREST relationship to profiles), so look emails up separately.
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(isUuid))];
  const emails = new Map<string, string>();
  if (actorIds.length) {
    const { data: actors } = await supabase.from("profiles").select("id, email").in("id", actorIds);
    for (const a of actors ?? []) emails.set(a.id as string, a.email as string);
  }

  const hasFilters = Boolean(filters.action || filters.entity || filters.from || filters.to);
  const params = { action: filters.action, entity: filters.entity, from: filters.from, to: filters.to };

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Administrative and security-relevant actions: settings changes, publication, downloads."
      />

      <FilterForm action="/admin/audit" hasFilters={hasFilters} label="Filter audit log">
        <FilterInput name="action" label="Action starts with" value={filters.action} placeholder="e.g. settings." maxLength={60} />
        <FilterInput name="entity" label="Entity type" value={filters.entity} placeholder="e.g. app_settings" maxLength={40} />
        <FilterInput name="from" label="From" type="date" value={filters.from} />
        <FilterInput name="to" label="To" type="date" value={filters.to} />
      </FilterForm>

      {error ? (
        <QueryError what="the audit log" />
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title={hasFilters ? "No entries match these filters" : "No audit entries yet"} />
      ) : (
        <TableWrap label="Audit log">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">When</th>
                <th scope="col" className="px-4 py-3 font-medium">Actor</th>
                <th scope="col" className="px-4 py-3 font-medium">Action</th>
                <th scope="col" className="px-4 py-3 font-medium">Entity</th>
                <th scope="col" className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y align-top">
              {rows.map((r) => {
                const meta = compactJson(r.metadata);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</td>
                    <td className="px-4 py-3 break-all">
                      {r.actor_id ? (emails.get(r.actor_id) ?? <span className="text-muted-foreground">Deleted user</span>) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-medium">{r.entity_type}</span>
                      {r.entity_id ? <span className="block break-all text-muted-foreground">{r.entity_id}</span> : null}
                    </td>
                    <td className="max-w-sm px-4 py-3">
                      {meta ? (
                        <code className="block font-mono text-xs break-all whitespace-pre-wrap text-muted-foreground">
                          {meta}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}

      <PaginationNav
        path="/admin/audit"
        page={filters.page}
        totalPages={totalPages(count, DEFAULT_PAGE_SIZE)}
        totalCount={count}
        params={params}
      />
    </>
  );
}
