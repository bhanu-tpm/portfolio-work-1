import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isEmailConfigured } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import type { Notification } from "@/lib/db/types";
import { DEFAULT_PAGE_SIZE, pageRange, totalPages } from "@/lib/pagination";
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES, parseNotificationFilters } from "@/lib/validation/admin";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { FilterForm, FilterSelect, QueryError, TableWrap } from "@/components/admin-ops/filters";
import { notificationStatusMeta } from "./meta";

export const metadata: Metadata = { title: "Notifications" };

type Row = Pick<
  Notification,
  "id" | "user_id" | "type" | "channel" | "recipient_email" | "subject" | "status" | "error" | "created_at" | "sent_at"
>;

export default async function NotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  await requireAdmin();
  const filters = parseNotificationFilters(await searchParams);
  const supabase = await createClient();

  const { from, to } = pageRange(filters.page);
  let query = supabase
    .from("notifications")
    .select("id, user_id, type, channel, recipient_email, subject, status, error, created_at, sent_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.channel) query = query.eq("channel", filters.channel);
  const { data, count, error } = await query;
  if (error) console.error("[admin/notifications] list failed", error.message);
  const rows = (data ?? []) as Row[];
  const hasFilters = Boolean(filters.status || filters.channel);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Every email and in-app notification with its delivery status, so delivery problems are visible."
      />
      {!isEmailConfigured() ? (
        <p className="mb-4 rounded-lg bg-warning/10 p-3 text-sm" role="note">
          Resend is not configured, so email notifications are recorded as <strong>skipped</strong>. See{" "}
          <Link href="/admin/settings#integrations" className="underline">
            Settings
          </Link>
          .
        </p>
      ) : null}

      <FilterForm action="/admin/notifications" hasFilters={hasFilters}>
        <FilterSelect
          name="status"
          label="Status"
          value={filters.status}
          options={NOTIFICATION_STATUSES.map((s) => ({ value: s, label: notificationStatusMeta[s].label }))}
        />
        <FilterSelect
          name="channel"
          label="Channel"
          value={filters.channel}
          options={NOTIFICATION_CHANNELS.map((c) => ({ value: c, label: c === "email" ? "Email" : "In-app" }))}
        />
      </FilterForm>

      {error ? (
        <QueryError what="notifications" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={hasFilters ? "No notifications match these filters" : "No notifications yet"}
        />
      ) : (
        <TableWrap label="Notifications">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Created</th>
                <th scope="col" className="px-4 py-3 font-medium">Notification</th>
                <th scope="col" className="px-4 py-3 font-medium">Recipient</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y align-top">
              {rows.map((n) => {
                const meta = notificationStatusMeta[n.status];
                return (
                  <tr key={n.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(n.created_at)}
                      {n.sent_at ? <span className="block text-xs">Sent {formatDateTime(n.sent_at)}</span> : null}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="font-medium break-words">{n.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.type} · {n.channel === "email" ? "Email" : "In-app"}
                      </p>
                    </td>
                    <td className="px-4 py-3 break-all">
                      {n.user_id ? (
                        <Link href={`/admin/clients/${n.user_id}`} className="hover:underline">
                          {n.recipient_email ?? "Client"}
                        </Link>
                      ) : (
                        <span>{n.recipient_email ?? "Administrator"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs break-words text-destructive">{n.error ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}

      <PaginationNav
        path="/admin/notifications"
        page={filters.page}
        totalPages={totalPages(count, DEFAULT_PAGE_SIZE)}
        totalCount={count}
        params={{ status: filters.status, channel: filters.channel }}
      />
    </>
  );
}
