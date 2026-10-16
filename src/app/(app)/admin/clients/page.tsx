import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { DEFAULT_PAGE_SIZE, pageRange, totalPages } from "@/lib/pagination";
import { buildIlikeOrFilter, isUuid, parseClientFilters } from "@/lib/validation/admin";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { FilterForm, FilterInput, QueryError, TableWrap } from "@/components/admin-ops/filters";

export const metadata: Metadata = { title: "Clients" };

interface ClientRow {
  id: string;
  email: string;
  full_name: string;
  organization: string | null;
  education_status: string | null;
  ai_consent: boolean;
  email_notifications: boolean;
  created_at: string;
  requests: { count: number }[] | null;
  appointments: { count: number }[] | null;
}

const countOf = (rel: { count: number }[] | null) => rel?.[0]?.count ?? 0;

export default async function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  await requireAdmin();
  const filters = parseClientFilters(await searchParams);
  const supabase = await createClient();

  // Clients are every account without the admin role (all sign-ups get the client role).
  const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  const adminIds = (adminRoles ?? []).map((r) => r.user_id as string).filter(isUuid);

  const { from, to } = pageRange(filters.page);
  let query = supabase
    .from("profiles")
    .select(
      "id, email, full_name, organization, education_status, ai_consent, email_notifications, created_at, requests:consultation_requests!client_id(count), appointments:appointments!client_id(count)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  if (adminIds.length) query = query.not("id", "in", `(${adminIds.join(",")})`);
  // The term is sanitised to letters/digits/@._+'- and quoted, so it can't alter the filter.
  if (filters.q) query = query.or(buildIlikeOrFilter(["full_name", "email"], filters.q));

  const { data, count, error } = await query;
  if (error) console.error("[admin/clients] list failed", error.message);
  const clients = (data ?? []) as unknown as ClientRow[];
  const pages = totalPages(count, DEFAULT_PAGE_SIZE);

  return (
    <>
      <PageHeader title="Clients" description="Everyone who has created an account, with their activity." />

      <FilterForm action="/admin/clients" hasFilters={Boolean(filters.q)} label="Search clients">
        <FilterInput name="q" label="Search name or email" type="search" value={filters.q} placeholder="e.g. priya" />
      </FilterForm>

      {error ? (
        <QueryError what="clients" />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filters.q ? "No clients match your search" : "No clients yet"}
          description={filters.q ? "Try a different name or email." : "Clients appear here once they sign up."}
        />
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10 md:hidden">
            {clients.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/clients/${c.id}`} className="block p-4 hover:bg-muted/50">
                  <p className="font-medium">{c.full_name || "Unnamed client"}</p>
                  <p className="text-sm break-all text-muted-foreground">{c.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {countOf(c.requests)} requests · {countOf(c.appointments)} appointments · Joined{" "}
                    {formatDate(c.created_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block">
            <TableWrap label="Clients">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Client</th>
                    <th scope="col" className="px-4 py-3 font-medium">Organisation</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Requests</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Appointments</th>
                    <th scope="col" className="px-4 py-3 font-medium">AI consent</th>
                    <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clients.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/clients/${c.id}`} className="font-medium hover:underline">
                          {c.full_name || "Unnamed client"}
                        </Link>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.organization ?? c.education_status ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{countOf(c.requests)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{countOf(c.appointments)}</td>
                      <td className="px-4 py-3">{c.ai_consent ? "Yes" : "No"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        </>
      )}

      <PaginationNav
        path="/admin/clients"
        page={filters.page}
        totalPages={pages}
        totalCount={count}
        params={{ q: filters.q }}
      />
    </>
  );
}
