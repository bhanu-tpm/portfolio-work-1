import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { APPOINTMENT_STATUSES, type Appointment } from "@/lib/db/types";
import { appointmentStatusMeta, formatDateTime, formatLabel, formatTime, formatTimeZoneName } from "@/lib/format";
import { appointmentFiltersSchema, type AppointmentFilters } from "@/lib/validation/booking";
import { localDateRangeToUtc, pageRange } from "@/lib/booking/rules";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Appointments" };

const PAGE_SIZE = 20;

type Row = Appointment & {
  client: { full_name: string; email: string } | null;
  request: { reference_code: string; category: { title: string } | null } | null;
};

function hrefWith(filters: AppointmentFilters, patch: Partial<AppointmentFilters>) {
  const merged = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (merged.view !== "upcoming") params.set("view", merged.view);
  if (merged.status !== "all") params.set("status", merged.status);
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  if (merged.page > 1) params.set("page", String(merged.page));
  const qs = params.toString();
  return `/admin/appointments${qs ? `?${qs}` : ""}`;
}

export default async function AdminAppointmentsPage({ searchParams }: PageProps<"/admin/appointments">) {
  await requireAdmin();
  const sp = await searchParams;
  const filters = appointmentFiltersSchema.parse({
    view: sp.view,
    status: sp.status,
    from: sp.from,
    to: sp.to,
    page: sp.page,
  });
  const settings = await getSettings("booking");
  const { from, to, page } = pageRange(filters.page, PAGE_SIZE);
  const range = localDateRangeToUtc(filters.from, filters.to, settings.timezone);
  const nowIso = new Date().toISOString();

  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select(
      "*, client:profiles!appointments_client_id_fkey(full_name, email), request:consultation_requests(reference_code, category:consultation_categories(title))",
      { count: "exact" },
    );
  query = filters.view === "upcoming" ? query.gte("ends_at", nowIso) : query.lt("ends_at", nowIso);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (range.from) query = query.gte("starts_at", range.from.toISOString());
  if (range.to) query = query.lt("starts_at", range.to.toISOString());
  const { data, count, error } = await query
    .order("starts_at", { ascending: filters.view === "upcoming" })
    .range(from, to);

  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tz = formatTimeZoneName(settings.timezone);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Appointments"
        description={`Bookings, confirmations and change requests. Times in ${tz} (${settings.timezone}).`}
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/availability">Availability</Link>
          </Button>
        }
      />

      <nav aria-label="Appointment views" className="flex gap-2">
        {(["upcoming", "past"] as const).map((view) => (
          <Button key={view} asChild size="sm" variant={filters.view === view ? "default" : "outline"}>
            <Link href={hrefWith(filters, { view, page: 1 })} aria-current={filters.view === view ? "page" : undefined}>
              {view === "upcoming" ? "Upcoming" : "Past"}
            </Link>
          </Button>
        ))}
      </nav>

      <form method="get" className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        {filters.view !== "upcoming" ? <input type="hidden" name="view" value={filters.view} /> : null}
        <div className="grid gap-1.5">
          <label htmlFor="filter-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={filters.status}
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="all">All statuses</option>
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {appointmentStatusMeta[s].label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="filter-from" className="text-sm font-medium">
            From
          </label>
          <input id="filter-from" type="date" name="from" defaultValue={filters.from ?? ""} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="filter-to" className="text-sm font-medium">
            To
          </label>
          <input id="filter-to" type="date" name="to" defaultValue={filters.to ?? ""} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm" />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            Filter
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={hrefWith(filters, { status: "all", from: undefined, to: undefined, page: 1 })}>Reset</Link>
          </Button>
        </div>
      </form>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Appointments could not be loaded</AlertTitle>
          <AlertDescription>Please refresh the page.</AlertDescription>
        </Alert>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={filters.view === "upcoming" ? "No upcoming appointments" : "No past appointments"}
          description="Try changing the filters."
        />
      ) : (
        <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
          {rows.map((a) => {
            const meta = appointmentStatusMeta[a.status];
            return (
              <li key={a.id}>
                <Link
                  href={`/admin/appointments/${a.id}`}
                  className="flex flex-col gap-2 p-4 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {formatDateTime(a.starts_at, a.timezone)} – {formatTime(a.ends_at, a.timezone)}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {a.client?.full_name || a.client?.email || "Client"} · {a.request?.reference_code ?? "—"} ·{" "}
                      {a.request?.category?.title ?? "Consultation"} · {formatLabel(a.format)}
                    </p>
                    {a.change_request_reason && (a.status === "reschedule_requested" || a.status === "cancellation_requested") ? (
                      <p className="mt-1 line-clamp-2 text-sm">Client: “{a.change_request_reason}”</p>
                    ) : null}
                  </div>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE_SIZE ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={hrefWith(filters, { page: page - 1 })}>
                <ChevronLeft data-icon="inline-start" /> Previous
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {page} of {pages} · {total} appointments
          </span>
          {page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={hrefWith(filters, { page: page + 1 })}>
                Next <ChevronRight data-icon="inline-end" />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
