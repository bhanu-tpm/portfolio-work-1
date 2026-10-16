import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate, requestStatusMeta } from "@/lib/format";
import type { RequestStatus } from "@/lib/db/types";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Consultation requests" };

export default async function MyRequestsPage() {
  const user = await requireUser("/dashboard/requests");
  const supabase = await createClient();
  const { data } = await supabase
    .from("consultation_requests")
    .select("id, reference_code, status, submitted_at, category:consultation_categories(title)")
    .eq("client_id", user.id)
    .order("submitted_at", { ascending: false });
  const requests = (data ?? []) as unknown as {
    id: string;
    reference_code: string;
    status: RequestStatus;
    submitted_at: string;
    category: { title: string } | null;
  }[];

  return (
    <>
      <PageHeader
        title="Consultation requests"
        description="Track the status of your requests."
        actions={
          <Button asChild>
            <Link href="/dashboard/requests/new">
              <Plus data-icon="inline-start" /> New request
            </Link>
          </Button>
        }
      />
      {requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No requests yet"
          description="Start by telling me about your situation and what you'd like help with."
          action={
            <Button asChild>
              <Link href="/dashboard/requests/new">Request a consultation</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
          {requests.map((r) => {
            const meta = requestStatusMeta[r.status];
            return (
              <li key={r.id}>
                <Link
                  href={`/dashboard/requests/${r.id}`}
                  className="flex flex-col gap-2 p-4 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{r.category?.title ?? "Consultation"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.reference_code} · Submitted {formatDate(r.submitted_at)}
                    </p>
                  </div>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
