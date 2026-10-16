"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { initialActionState } from "@/lib/action-result";
import type { BlogCategory, BlogPost } from "@/lib/db/types";
import { formatDateTime, postStatusMeta, slugify } from "@/lib/format";
import { countWords, readingMinutes } from "@/lib/validation/content";
import { FormMessage, NativeSelectField, SubmitButton, TextAreaField, TextField } from "@/components/shared/form";
import { Markdown } from "@/components/shared/markdown";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmActionForm, useActionToast } from "@/components/content-admin/action-forms";
import { ImageField } from "@/components/content-admin/image-field";
import { LanguageTabs } from "@/components/content-admin/hindi";
import { HINDI_HINT } from "@/components/content-admin/hindi-text";
import { deletePost, savePost } from "./actions";

type EditablePost = Pick<
  BlogPost,
  | "id"
  | "title"
  | "slug"
  | "excerpt"
  | "content"
  | "category_id"
  | "cover_image_url"
  | "cover_image_alt"
  | "seo_title"
  | "seo_description"
  | "status"
  | "published_at"
  | "updated_at"
  | "title_hi"
  | "excerpt_hi"
  | "content_hi"
  | "seo_title_hi"
  | "seo_description_hi"
  | "cover_image_alt_hi"
>;

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-xs font-medium text-destructive">
      {message}
    </p>
  ) : null;
}

export function PostEditor({
  post,
  tags,
  categories,
}: {
  post?: EditablePost;
  tags?: string;
  categories: BlogCategory[];
}) {
  const [state, action] = useActionState(savePost, initialActionState);
  useActionToast(state);
  const v = state.values;

  const [title, setTitle] = useState(v?.title ?? post?.title ?? "");
  const [slug, setSlug] = useState(v?.slug ?? post?.slug ?? "");
  // New posts follow the title until the slug is edited by hand.
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [content, setContent] = useState(v?.content ?? post?.content ?? "");
  const [contentHi, setContentHi] = useState(v?.contentHi ?? post?.content_hi ?? "");

  const errors = state.fieldErrors ?? {};
  const status = post?.status ?? "draft";
  const meta = postStatusMeta[status];
  const words = countWords(content);
  const wordsHi = countWords(contentHi);

  return (
    <div className="grid gap-6">
      {post ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          {post.published_at ? <span>First published {formatDateTime(post.published_at)}</span> : null}
          <span>Last saved {formatDateTime(post.updated_at)}</span>
          {status === "published" ? (
            <Link href={`/blog/${post.slug}`} target="_blank" className="inline-flex items-center gap-1 text-teal underline">
              View live <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </Link>
          ) : null}
        </div>
      ) : null}

      <form action={action} className="grid gap-6" noValidate>
        {post ? <input type="hidden" name="id" value={post.id} /> : null}
        <FormMessage state={state} />

        <section className="grid gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
          <LanguageTabs
            label="Post language"
            state={state}
            englishFields={["title", "slug", "excerpt", "content"]}
            hindiFields={["titleHi", "excerptHi", "contentHi"]}
            hindiFilled={Boolean(post?.title_hi || post?.excerpt_hi || post?.content_hi)}
            english={
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="field-title">
                    Title<span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="field-title"
                    name="title"
                    value={title}
                    required
                    maxLength={200}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!slugTouched) setSlug(slugify(e.target.value));
                    }}
                    aria-invalid={errors.title ? true : undefined}
                    aria-describedby={errors.title ? "field-title-error" : undefined}
                  />
                  <FieldError id="field-title-error" message={errors.title?.[0]} />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="field-slug">
                    Slug<span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="field-slug"
                      name="slug"
                      value={slug}
                      required
                      maxLength={80}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setSlug(e.target.value);
                      }}
                      aria-invalid={errors.slug ? true : undefined}
                      aria-describedby={["field-slug-help", errors.slug ? "field-slug-error" : ""].filter(Boolean).join(" ")}
                    />
                    <Button type="button" variant="outline" onClick={() => setSlug(slugify(title))} disabled={!title}>
                      From title
                    </Button>
                  </div>
                  <p id="field-slug-help" className="text-xs text-muted-foreground">
                    Public address: /blog/{slug || "…"}
                    {status === "published" ? " — changing it breaks existing links." : ""}
                  </p>
                  <FieldError id="field-slug-error" message={errors.slug?.[0]} />
                </div>

                <TextAreaField
                  name="excerpt"
                  label="Excerpt"
                  rows={2}
                  maxLength={500}
                  state={state}
                  defaultValue={post?.excerpt}
                  description="One or two sentences shown in the post list and search results."
                />

                <div className="grid gap-1.5">
                  <Label htmlFor="field-content">Content (Markdown)</Label>
                  <Tabs defaultValue="write">
                    <TabsList aria-label="Content editor mode">
                      <TabsTrigger value="write">Write</TabsTrigger>
                      <TabsTrigger value="preview">Preview</TabsTrigger>
                    </TabsList>
                    <TabsContent value="write" forceMount className="data-[state=inactive]:hidden">
                      <Textarea
                        id="field-content"
                        name="content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={18}
                        maxLength={100_000}
                        className="font-mono text-sm"
                        aria-invalid={errors.content ? true : undefined}
                        aria-describedby={["field-content-help", errors.content ? "field-content-error" : ""]
                          .filter(Boolean)
                          .join(" ")}
                      />
                    </TabsContent>
                    <TabsContent value="preview">
                      <div className="min-h-48 rounded-lg p-4 ring-1 ring-border">
                        {content.trim() ? (
                          <Markdown>{content}</Markdown>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                  <p id="field-content-help" className="text-xs text-muted-foreground" aria-live="polite">
                    {words} words · about {readingMinutes(content)} min read. Raw HTML is not rendered; images must use https.
                  </p>
                  <FieldError id="field-content-error" message={errors.content?.[0]} />
                </div>
              </>
            }
            hindi={
              <>
                <TextField name="titleHi" label="Title (Hindi)" lang="hi" state={state} defaultValue={post?.title_hi} maxLength={200} />
                <TextAreaField
                  name="excerptHi"
                  label="Excerpt (Hindi)"
                  lang="hi"
                  rows={2}
                  maxLength={500}
                  state={state}
                  defaultValue={post?.excerpt_hi}
                />
                <div className="grid gap-1.5">
                  <Label htmlFor="field-contentHi">Content (Hindi, Markdown)</Label>
                  <Tabs defaultValue="write">
                    <TabsList aria-label="Hindi content editor mode">
                      <TabsTrigger value="write">Write</TabsTrigger>
                      <TabsTrigger value="preview">Preview</TabsTrigger>
                    </TabsList>
                    <TabsContent value="write" forceMount className="data-[state=inactive]:hidden">
                      <Textarea
                        id="field-contentHi"
                        name="contentHi"
                        lang="hi"
                        value={contentHi}
                        onChange={(e) => setContentHi(e.target.value)}
                        rows={18}
                        maxLength={100_000}
                        className="font-mono text-sm"
                        aria-invalid={errors.contentHi ? true : undefined}
                        aria-describedby={["field-contentHi-help", errors.contentHi ? "field-contentHi-error" : ""]
                          .filter(Boolean)
                          .join(" ")}
                      />
                    </TabsContent>
                    <TabsContent value="preview">
                      <div lang="hi" className="min-h-48 rounded-lg p-4 ring-1 ring-border">
                        {contentHi.trim() ? (
                          <Markdown>{contentHi}</Markdown>
                        ) : (
                          <p lang="en" className="text-sm text-muted-foreground">
                            No Hindi content. {HINDI_HINT}
                          </p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                  <p id="field-contentHi-help" className="text-xs text-muted-foreground" aria-live="polite">
                    {contentHi.trim()
                      ? `${wordsHi} words · about ${readingMinutes(contentHi)} min read.`
                      : "Empty: the Hindi site shows the English content."}
                  </p>
                  <FieldError id="field-contentHi-error" message={errors.contentHi?.[0]} />
                </div>
              </>
            }
          />
        </section>

        <section className="grid gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">Organisation and media</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <NativeSelectField
              name="categoryId"
              label="Category"
              state={state}
              defaultValue={post?.category_id ?? ""}
              options={[{ value: "", label: "Uncategorised" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              description={
                <>
                  <Link href="/admin/blog/categories" className="underline">
                    Manage categories
                  </Link>
                </>
              }
            />
            <TextField
              name="tags"
              label="Tags"
              state={state}
              defaultValue={tags}
              maxLength={500}
              placeholder="interviews, resumes, internships"
              description="Comma-separated, up to 10. New tags are created automatically."
            />
          </div>
          <ImageField
            key={post?.cover_image_url ?? "none"}
            label="Cover image"
            fileName="coverFile"
            urlName="coverImageUrl"
            defaultUrl={post?.cover_image_url}
            state={state}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              name="coverImageAlt"
              label="Cover image alt text"
              state={state}
              defaultValue={post?.cover_image_alt}
              maxLength={200}
              description="Describe the image for screen-reader users. Leave empty only for purely decorative images."
            />
            <TextField
              name="coverImageAltHi"
              label="Cover image alt text — हिंदी (Hindi), optional"
              lang="hi"
              state={state}
              defaultValue={post?.cover_image_alt_hi}
              maxLength={200}
              description={HINDI_HINT}
            />
          </div>
        </section>

        <section className="grid gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">Search engines</h2>
          <LanguageTabs
            label="Search engine text language"
            state={state}
            englishFields={["seoTitle", "seoDescription"]}
            hindiFields={["seoTitleHi", "seoDescriptionHi"]}
            hindiFilled={Boolean(post?.seo_title_hi || post?.seo_description_hi)}
            english={
              <>
                <TextField
                  name="seoTitle"
                  label="SEO title"
                  state={state}
                  defaultValue={post?.seo_title}
                  maxLength={70}
                  description="Optional, up to 70 characters. Defaults to the post title."
                />
                <TextAreaField
                  name="seoDescription"
                  label="SEO description"
                  rows={2}
                  state={state}
                  defaultValue={post?.seo_description}
                  maxLength={170}
                  description="Optional, up to 170 characters. Defaults to the excerpt."
                />
              </>
            }
            hindi={
              <>
                <TextField
                  name="seoTitleHi"
                  label="SEO title (Hindi)"
                  lang="hi"
                  state={state}
                  defaultValue={post?.seo_title_hi}
                  maxLength={70}
                  description="Up to 70 characters."
                />
                <TextAreaField
                  name="seoDescriptionHi"
                  label="SEO description (Hindi)"
                  lang="hi"
                  rows={2}
                  state={state}
                  defaultValue={post?.seo_description_hi}
                  maxLength={170}
                  description="Up to 170 characters."
                />
              </>
            }
          />
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {status === "published" ? (
            <>
              <SubmitButton name="intent" value="unpublish" variant="outline" pendingLabel="Saving…" className="h-10 px-4">
                Unpublish
              </SubmitButton>
              <SubmitButton name="intent" value="save" pendingLabel="Saving…" className="h-10 px-5">
                Save changes
              </SubmitButton>
            </>
          ) : (
            <>
              <SubmitButton name="intent" value="save" variant="outline" pendingLabel="Saving…" className="h-10 px-4">
                Save draft
              </SubmitButton>
              <SubmitButton name="intent" value="publish" pendingLabel="Publishing…" className="h-10 px-5">
                Publish
              </SubmitButton>
            </>
          )}
        </div>
      </form>

      {post ? (
        <section className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-destructive/30 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="font-sans text-base font-semibold tracking-normal">Delete post</h2>
            <p className="text-sm text-muted-foreground">Permanently removes the post and its cover image. Consider unpublishing instead.</p>
          </div>
          <ConfirmActionForm
            action={deletePost}
            fields={{ id: post.id }}
            triggerLabel="Delete post"
            triggerIcon={<Trash2 aria-hidden />}
            title="Delete this post?"
            description={`"${post.title}" will be permanently deleted. This cannot be undone.`}
          />
        </section>
      ) : null}
    </div>
  );
}
