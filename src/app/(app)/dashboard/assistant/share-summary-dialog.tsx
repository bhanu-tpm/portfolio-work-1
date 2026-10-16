"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SUMMARY_MAX, SUMMARY_MESSAGE_PREFIX } from "@/lib/validation/student-ai";
import { saveSummaryToRequest } from "./actions";

export function ShareSummaryDialog({
  conversationId,
  summary,
  requests,
}: {
  conversationId: string;
  summary: string;
  requests: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState(requests[0]?.id ?? "");
  const [text, setText] = useState(summary);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (requests.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        To share this summary with the consultant,{" "}
        <Link href="/dashboard/requests/new" className="underline underline-offset-4">
          create a consultation request
        </Link>{" "}
        first.
      </p>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await saveSummaryToRequest({ conversationId, requestId, summary: text, confirm: confirmed });
      if (result.ok) {
        toast.success(result.message ?? "Summary shared.");
        setOpen(false);
        setConfirmed(false);
      } else {
        setError(result.message ?? "The summary couldn't be shared.");
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (pending) return;
        setOpen(v);
        if (v) {
          setText(summary);
          setConfirmed(false);
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Share2 data-icon="inline-start" aria-hidden /> Save summary to my consultation request
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Share this summary with the consultant?</AlertDialogTitle>
          <AlertDialogDescription>
            The summary is added as a message on the request you choose and will be visible to the consultant. Your full
            conversation is not shared.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="share-request">Consultation request</Label>
            <select
              id="share-request"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="share-summary">Summary (you can edit it before sharing)</Label>
            <Textarea
              id="share-summary"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              maxLength={SUMMARY_MAX}
              aria-describedby="share-summary-hint"
            />
            <p id="share-summary-hint" className="text-xs text-muted-foreground">
              It will be posted as: &ldquo;{SUMMARY_MESSAGE_PREFIX} …&rdquo;
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <input
              id="share-confirm"
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-input accent-[var(--primary)]"
            />
            <label htmlFor="share-confirm" className="text-sm leading-snug">
              I want to share this AI-generated summary with the consultant.
            </label>
          </div>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button type="button" onClick={submit} disabled={pending || !confirmed || !requestId || !text.trim()}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden /> Sharing…
              </>
            ) : (
              "Share summary"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
