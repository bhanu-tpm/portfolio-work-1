"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { initialActionState } from "@/lib/action-result";
import type { PortfolioItem } from "@/lib/db/types";
import {
  CheckboxField,
  FormMessage,
  NativeSelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useActionToast } from "@/components/content-admin/action-forms";
import { LanguageTabs } from "@/components/content-admin/hindi";
import { savePortfolioItem } from "./actions";

export const KIND_LABELS: Record<PortfolioItem["kind"], string> = {
  expertise: "Expertise",
  experience: "Experience",
  project: "Project",
  qualification: "Qualification",
  certification: "Certification",
};

function ItemForm({ item, defaultSortOrder, onDone }: { item?: PortfolioItem; defaultSortOrder: number; onDone: () => void }) {
  const [state, action] = useActionState(savePortfolioItem, initialActionState);
  useActionToast(state, onDone);
  return (
    <form action={action} className="grid gap-4" noValidate>
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <FormMessage state={state} />
      <NativeSelectField
        name="kind"
        label="Type"
        required
        state={state}
        defaultValue={item?.kind ?? "experience"}
        options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <LanguageTabs
        label="Item text language"
        state={state}
        englishFields={["title", "subtitle", "description", "period"]}
        hindiFields={["titleHi", "subtitleHi", "descriptionHi", "periodHi"]}
        hindiFilled={Boolean(item?.title_hi || item?.subtitle_hi || item?.description_hi || item?.period_hi)}
        english={
          <>
            <TextField name="title" label="Title" required state={state} defaultValue={item?.title} maxLength={200} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="subtitle" label="Subtitle" state={state} defaultValue={item?.subtitle} maxLength={200} description="e.g. organisation or issuing body" />
              <TextField name="period" label="Period" state={state} defaultValue={item?.period} maxLength={80} placeholder="2021 – present" />
            </div>
            <TextAreaField name="description" label="Description" rows={4} state={state} defaultValue={item?.description} maxLength={2000} />
          </>
        }
        hindi={
          <>
            <TextField name="titleHi" label="Title (Hindi)" lang="hi" state={state} defaultValue={item?.title_hi} maxLength={200} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="subtitleHi" label="Subtitle (Hindi)" lang="hi" state={state} defaultValue={item?.subtitle_hi} maxLength={200} />
              <TextField name="periodHi" label="Period (Hindi)" lang="hi" state={state} defaultValue={item?.period_hi} maxLength={80} />
            </div>
            <TextAreaField
              name="descriptionHi"
              label="Description (Hindi)"
              lang="hi"
              rows={4}
              state={state}
              defaultValue={item?.description_hi}
              maxLength={2000}
            />
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <TextField name="url" label="Link (optional)" type="url" state={state} defaultValue={item?.url} placeholder="https://" description="Verification or project link." />
        <TextField name="sortOrder" label="Sort order" type="number" min="0" max="1000" state={state} defaultValue={item?.sort_order ?? defaultSortOrder} />
      </div>
      <CheckboxField name="isVisible" label="Visible on the public portfolio" state={state} defaultChecked={item?.is_visible ?? true} />
      <DialogFooter>
        <SubmitButton className="h-9 px-4">{item ? "Save item" : "Add item"}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

export function PortfolioItemDialog({ item, defaultSortOrder = 0 }: { item?: PortfolioItem; defaultSortOrder?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="outline" size="sm">
            <Pencil aria-hidden /> Edit<span className="sr-only"> {item.title}</span>
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" aria-hidden /> Add item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit portfolio item" : "Add portfolio item"}</DialogTitle>
          <DialogDescription>Only add facts you can verify — no invented roles, results or credentials.</DialogDescription>
        </DialogHeader>
        {open ? <ItemForm item={item} defaultSortOrder={defaultSortOrder} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
