"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/lib/action-result";
import type { OutcomeStatus } from "@/lib/db/types";
import { FormMessage, SubmitButton } from "@/components/shared/form";
import { approveOutcome, archiveOutcome, publishOutcome, revokeApproval, uploadOutcomePdf } from "../actions";

function useToast(state: ActionState) {
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    else if (!state.ok && state.message) toast.error(state.message);
  }, [state]);
}

function ConfirmForm({
  action,
  outcomeId,
  trigger,
  title,
  description,
  confirmLabel,
  variant = "default",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  outcomeId: string;
  trigger: string;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [open, setOpen] = useState(false);
  useToast(state);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} disabled={pending} className="w-full">
          {trigger}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form
          action={(fd) => {
            formAction(fd);
            setOpen(false);
          }}
        >
          <input type="hidden" name="outcomeId" value={outcomeId} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit">{confirmLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ApprovalPanel({
  outcomeId,
  status,
  latestVersionId,
  latestVersionNumber,
  approvedVersionNumber,
}: {
  outcomeId: string;
  status: OutcomeStatus;
  latestVersionId: string;
  latestVersionNumber: number;
  approvedVersionNumber: number | null;
}) {
  const [approveState, approveAction] = useActionState(approveOutcome, initialActionState);
  useToast(approveState.ok ? approveState : { ok: false });

  if (status === "draft") {
    return (
      <form action={approveAction} className="grid gap-3">
        <input type="hidden" name="outcomeId" value={outcomeId} />
        <input type="hidden" name="versionId" value={latestVersionId} />
        <FormMessage state={approveState.ok ? { ok: false } : approveState} />
        <p className="text-sm text-muted-foreground">
          Approving locks version {latestVersionNumber} for publication. Nothing is visible to the client until you publish.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirmReviewed" required className="mt-0.5 size-4 accent-[var(--primary)]" />
          I have read and reviewed every section of version {latestVersionNumber}, including any AI-generated text.
        </label>
        <SubmitButton pendingLabel="Approving…">Approve version {latestVersionNumber}</SubmitButton>
        <ConfirmForm
          action={archiveOutcome}
          outcomeId={outcomeId}
          trigger="Archive draft"
          title="Archive this outcome?"
          description="The draft will be hidden from the approval queue. This can't be undone."
          confirmLabel="Archive"
          variant="outline"
        />
      </form>
    );
  }

  if (status === "approved") {
    return (
      <div className="grid gap-3">
        <p className="text-sm">
          Version {approvedVersionNumber} is approved and ready to publish. Publishing makes it visible and downloadable for the
          client and emails them.
        </p>
        <ConfirmForm
          action={publishOutcome}
          outcomeId={outcomeId}
          trigger="Publish to client"
          title="Publish this outcome?"
          description={`Version ${approvedVersionNumber} will be released to the client and they will be notified. Any earlier published outcome for this request will be marked as superseded.`}
          confirmLabel="Publish"
        />
        <ConfirmForm
          action={revokeApproval}
          outcomeId={outcomeId}
          trigger="Withdraw approval"
          title="Withdraw approval?"
          description="The outcome returns to draft so you can keep editing."
          confirmLabel="Withdraw"
          variant="outline"
        />
      </div>
    );
  }

  if (status === "published") {
    return (
      <div className="grid gap-3">
        <p className="text-sm">
          Published. To correct it, create a new outcome for the same request — publishing it will supersede this one and
          keep the audit trail.
        </p>
        <ConfirmForm
          action={archiveOutcome}
          outcomeId={outcomeId}
          trigger="Retract (archive)"
          title="Retract this published outcome?"
          description="The client will no longer be able to view or download it. This is recorded in the audit log."
          confirmLabel="Retract"
          variant="destructive"
        />
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">This outcome is {status} and can no longer change.</p>;
}

export function PdfUploadForm({ outcomeId, latestVersionNumber }: { outcomeId: string; latestVersionNumber: number }) {
  const [state, action] = useActionState(uploadOutcomePdf, initialActionState);
  useToast(state.ok ? state : { ok: false });
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="outcomeId" value={outcomeId} />
      <FormMessage state={state.ok ? { ok: false } : state} />
      <label htmlFor="outcome-pdf" className="text-sm font-medium">
        Upload a final PDF (optional)
      </label>
      <input
        id="outcome-pdf"
        name="file"
        type="file"
        accept="application/pdf,.pdf"
        required
        className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Attaches to version {latestVersionNumber}. Without an upload, a PDF is generated from the approved content.
      </p>
      <div>
        <SubmitButton size="sm" variant="outline" pendingLabel="Uploading…">
          Upload PDF
        </SubmitButton>
      </div>
    </form>
  );
}
