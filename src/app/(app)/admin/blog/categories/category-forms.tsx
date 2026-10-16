"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { initialActionState } from "@/lib/action-result";
import type { BlogCategory, BlogTag } from "@/lib/db/types";
import { slugify } from "@/lib/format";
import { SubmitButton } from "@/components/shared/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmActionForm, useActionToast } from "@/components/content-admin/action-forms";
import { HindiLabel } from "@/components/content-admin/hindi";
import { HINDI_HINT } from "@/components/content-admin/hindi-text";
import { deleteBlogCategory, saveBlogCategory, saveBlogTagHindi } from "../actions";

/** Create (no category) or rename (with category) form. */
export function BlogCategoryForm({ category }: { category?: BlogCategory & { post_count?: number } }) {
  const [state, action] = useActionState(saveBlogCategory, initialActionState);
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [nameHi, setNameHi] = useState(category?.name_hi ?? "");
  useActionToast(state, () => {
    if (!category) {
      setName("");
      setSlug("");
      setNameHi("");
    }
  });
  const prefix = category ? `cat-${category.id}` : "cat-new";
  const nameError = state.fieldErrors?.name?.[0];
  const slugError = state.fieldErrors?.slug?.[0];
  const nameHiError = state.fieldErrors?.nameHi?.[0];

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <form action={action} className="grid flex-1 gap-3 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end" noValidate>
        {category ? <input type="hidden" name="id" value={category.id} /> : null}
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefix}-name`}>Name</Label>
          <Input
            id={`${prefix}-name`}
            name="name"
            value={name}
            maxLength={80}
            required
            onChange={(e) => {
              setName(e.target.value);
              if (!category) setSlug(slugify(e.target.value));
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${prefix}-name-error` : undefined}
          />
          {nameError ? (
            <p id={`${prefix}-name-error`} className="text-xs font-medium text-destructive">
              {nameError}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefix}-slug`}>Slug</Label>
          <Input
            id={`${prefix}-slug`}
            name="slug"
            value={slug}
            maxLength={80}
            onChange={(e) => setSlug(e.target.value)}
            aria-invalid={slugError ? true : undefined}
            aria-describedby={slugError ? `${prefix}-slug-error` : undefined}
          />
          {slugError ? (
            <p id={`${prefix}-slug-error`} className="text-xs font-medium text-destructive">
              {slugError}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefix}-name-hi`}>
            <span>
              Name — <HindiLabel />
            </span>
          </Label>
          <Input
            id={`${prefix}-name-hi`}
            name="nameHi"
            lang="hi"
            value={nameHi}
            maxLength={80}
            placeholder="Optional"
            title={HINDI_HINT}
            onChange={(e) => setNameHi(e.target.value)}
            aria-invalid={nameHiError ? true : undefined}
            aria-describedby={nameHiError ? `${prefix}-name-hi-error` : undefined}
          />
          {nameHiError ? (
            <p id={`${prefix}-name-hi-error`} className="text-xs font-medium text-destructive">
              {nameHiError}
            </p>
          ) : null}
        </div>
        <SubmitButton className="h-9" variant={category ? "outline" : "default"}>
          {category ? "Save" : "Add category"}
        </SubmitButton>
      </form>
      {category ? (
        <ConfirmActionForm
          action={deleteBlogCategory}
          fields={{ id: category.id }}
          triggerLabel=""
          triggerSize="icon-lg"
          triggerIcon={
            <>
              <Trash2 aria-hidden />
              <span className="sr-only">Delete {category.name}</span>
            </>
          }
          title={`Delete "${category.name}"?`}
          description={
            category.post_count
              ? `${category.post_count} post(s) use this category and will become uncategorised.`
              : "No posts use this category."
          }
        />
      ) : null}
    </div>
  );
}

/** Sets the optional Hindi display name of an existing tag. */
export function BlogTagHindiForm({ tag }: { tag: Pick<BlogTag, "id" | "name" | "slug" | "name_hi"> & { post_count: number } }) {
  const [state, action] = useActionState(saveBlogTagHindi, initialActionState);
  useActionToast(state);
  const id = `tag-${tag.id}-name-hi`;
  const error = state.fieldErrors?.nameHi?.[0];
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-end" noValidate>
      <input type="hidden" name="id" value={tag.id} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{tag.name}</p>
        <p className="text-xs text-muted-foreground">
          {tag.post_count} post{tag.post_count === 1 ? "" : "s"}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id} className="text-xs">
          <span>
            Hindi name for “{tag.name}”
          </span>
        </Label>
        <Input
          id={id}
          name="nameHi"
          lang="hi"
          defaultValue={state.values?.nameHi ?? tag.name_hi ?? ""}
          maxLength={60}
          placeholder="Optional"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error ? (
          <p id={`${id}-error`} className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <SubmitButton className="h-9" variant="outline">
        Save
      </SubmitButton>
    </form>
  );
}
