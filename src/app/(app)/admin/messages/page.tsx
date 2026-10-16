import type { Metadata } from "next";
import Link from "next/link";
import { Check, Inbox, Mail, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "cn";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { pageCount, pageRange } from "@/lib/validation/content";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmActionForm, InlineActionForm } from "@/components/content-admin/action-forms";
import { ListPager } from "@/components/content-admin/list-pager";
import { deleteMessage, setMessageHandled } from "./actions";

export const metadata: Metadata = { title: "Contact messages" };

type Message = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  handled: boolean;
  created_at: string;
};

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "handled", label: "Handled" },
  { value: "all", label: "All" },
] as const;

export default async function AdminMessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  await requireAdmin();
  const sp = await searchParams;
  const show = FILTERS.some((f) => f.value === sp.show) ? (sp.show as string) : "all";
  const { page, from, to } = pageRange(sp.page);

  const supabase = await createClient();
  let query = supabase
    .from("contact_messages")
    .select("id, name, email, subject, message, handled, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (show === "open") query = query.eq("handled", false);
  if (show === "handled") query = query.eq("handled", true);
  const { data, count, error } = await query;
  const messages = (data ?? []) as Message[];
  const total = count ?? 0;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Contact messages" description="Messages sent through the public contact form, newest first." />

      <nav aria-label="Filter messages" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f.value} asChild size="sm" variant={show === f.value ? "default" : "outline"}>
            <Link href={f.value === "all" ? "/admin/messages" : `/admin/messages?show=${f.value}`} aria-current={show === f.value ? "page" : undefined}>
              {f.label}
            </Link>
          </Button>
        ))}
      </nav>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>Messages could not be loaded. Please refresh the page.</AlertDescription>
        </Alert>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={show === "open" ? "No open messages" : "No messages"}
          description={page > 1 ? "There are no messages on this page." : "New contact form submissions will appear here."}
        />
      ) : (
        <>
          <ul className="grid gap-3">
            {messages.map((m) => (
              <li key={m.id}>
                <article
                  className={cn("rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5", m.handled && "opacity-80")}
                  aria-labelledby={`msg-${m.id}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 id={`msg-${m.id}`} className="font-sans text-base font-semibold tracking-normal break-words">
                        {m.subject}
                      </h2>
                      <p className="text-sm text-muted-foreground break-words">
                        {m.name} ·{" "}
                        <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className="text-teal underline">
                          {m.email}
                        </a>{" "}
                        · <time dateTime={m.created_at}>{formatDateTime(m.created_at)}</time>
                      </p>
                    </div>
                    <StatusBadge tone={m.handled ? "neutral" : "info"}>{m.handled ? "Handled" : "Open"}</StatusBadge>
                  </div>
                  <p className="mt-3 text-sm break-words whitespace-pre-wrap">{m.message}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}>
                        <Mail aria-hidden /> Reply by email
                      </a>
                    </Button>
                    <InlineActionForm
                      action={setMessageHandled}
                      fields={{ id: m.id, value: m.handled ? "false" : "true" }}
                      pendingLabel="Saving…"
                    >
                      {m.handled ? (
                        <>
                          <RotateCcw aria-hidden /> Mark as open
                        </>
                      ) : (
                        <>
                          <Check aria-hidden /> Mark handled
                        </>
                      )}
                    </InlineActionForm>
                    <ConfirmActionForm
                      action={deleteMessage}
                      fields={{ id: m.id }}
                      triggerLabel="Delete"
                      triggerIcon={<Trash2 aria-hidden />}
                      title="Delete this message?"
                      description={`The message from ${m.name} will be permanently deleted.`}
                    />
                  </div>
                </article>
              </li>
            ))}
          </ul>
          <ListPager
            basePath="/admin/messages"
            params={{ show: show === "all" ? undefined : show }}
            page={page}
            pageCount={pageCount(total)}
            total={total}
          />
        </>
      )}
    </div>
  );
}
