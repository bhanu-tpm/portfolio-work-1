"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { refreshPublicContent } from "@/lib/admin-cache";
import { failure, formValues, validationFailure, type ActionState } from "@/lib/action-result";
import { blogPostSchema } from "@/lib/validation/schemas";
import {
  blogCategorySchema,
  blogTagHindiSchema,
  idSchema,
  parseTagList,
  postIntentSchema,
  readingMinutes,
} from "@/lib/validation/content";
import { formFile, removePublicImage, uploadPublicImage } from "@/lib/content-media";
import { slugify } from "@/lib/format";
import type { PostStatus } from "@/lib/db/types";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

async function syncPostTags(supabase: SupabaseServer, postId: string, tagInput: string | undefined) {
  const tags = parseTagList(tagInput);
  if (tags.length) {
    const { error: upsertError } = await supabase
      .from("blog_tags")
      .upsert(tags, { onConflict: "slug", ignoreDuplicates: true });
    if (upsertError) throw upsertError;
  }
  const { data: tagRows, error: selectError } = tags.length
    ? await supabase.from("blog_tags").select("id").in("slug", tags.map((t) => t.slug))
    : { data: [] as { id: string }[], error: null };
  if (selectError) throw selectError;

  const { error: deleteError } = await supabase.from("blog_post_tags").delete().eq("post_id", postId);
  if (deleteError) throw deleteError;
  if (tagRows && tagRows.length) {
    const { error: linkError } = await supabase
      .from("blog_post_tags")
      .insert(tagRows.map((t) => ({ post_id: postId, tag_id: t.id })));
    if (linkError) throw linkError;
  }
}

/** Create or update a post. `intent`: save (keep status; new = draft) | publish | unpublish. */
export async function savePost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = blogPostSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  const input = parsed.data;
  const intent = postIntentSchema.parse(values.intent);
  let createdId: string | null = null;
  let uploadedUrl: string | null = null;

  try {
    const user = await assertAdmin();
    const supabase = await createClient();

    type ExistingPost = { id: string; status: PostStatus; published_at: string | null; cover_image_url: string | null };
    let existing: ExistingPost | null = null;
    if (input.id) {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, status, published_at, cover_image_url")
        .eq("id", input.id)
        .maybeSingle<ExistingPost>();
      if (!data) return { ok: false, message: "This post no longer exists.", values };
      existing = data;
    }

    if (intent === "publish" && input.content.trim().length < 20) {
      return {
        ok: false,
        message: "Write some content before publishing.",
        fieldErrors: { content: ["Add at least a few sentences before publishing"] },
        values,
      };
    }

    const file = formFile(formData, "coverFile");
    if (file) {
      const uploaded = await uploadPublicImage(file, user.id, "blog");
      uploadedUrl = uploaded.url;
    }
    const coverUrl = uploadedUrl ?? input.coverImageUrl ?? null;

    let status: PostStatus = existing?.status ?? "draft";
    let publishedAt = existing?.published_at ?? null;
    if (intent === "publish") {
      status = "published";
      publishedAt = publishedAt ?? new Date().toISOString();
    } else if (intent === "unpublish") {
      status = existing ? "unpublished" : "draft";
    }

    const row = {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt ?? "",
      content: input.content,
      category_id: input.categoryId ?? null,
      cover_image_url: coverUrl,
      cover_image_alt: coverUrl ? (input.coverImageAlt ?? null) : null,
      seo_title: input.seoTitle ?? null,
      seo_description: input.seoDescription ?? null,
      // Optional Hindi versions: null when blank so the public site falls back to English.
      title_hi: input.titleHi ?? null,
      excerpt_hi: input.excerptHi ?? null,
      content_hi: input.contentHi ?? null,
      seo_title_hi: input.seoTitleHi ?? null,
      seo_description_hi: input.seoDescriptionHi ?? null,
      cover_image_alt_hi: coverUrl ? (input.coverImageAltHi ?? null) : null,
      reading_minutes: readingMinutes(input.content),
      status,
      published_at: publishedAt,
    };

    let postId: string;
    if (existing) {
      const { error } = await supabase.from("blog_posts").update(row).eq("id", existing.id);
      if (isUniqueViolation(error)) {
        await removePublicImage(uploadedUrl);
        return { ok: false, message: "That slug is already used.", fieldErrors: { slug: ["Choose a different slug"] }, values };
      }
      if (error) throw error;
      postId = existing.id;
    } else {
      const { data, error } = await supabase
        .from("blog_posts")
        .insert({ ...row, author_id: user.id })
        .select("id")
        .single();
      if (isUniqueViolation(error)) {
        await removePublicImage(uploadedUrl);
        return { ok: false, message: "That slug is already used.", fieldErrors: { slug: ["Choose a different slug"] }, values };
      }
      if (error || !data) throw error ?? new Error("Insert failed");
      postId = data.id;
      createdId = data.id;
    }

    await syncPostTags(supabase, postId, input.tags);

    // The old cover was replaced or removed: clean up our own copy.
    if (existing?.cover_image_url && existing.cover_image_url !== coverUrl) {
      await removePublicImage(existing.cover_image_url);
    }

    const action =
      intent === "publish"
        ? "post.published"
        : intent === "unpublish" && existing
          ? "post.unpublished"
          : existing
            ? "post.updated"
            : "post.created";
    await audit(user.id, action, "blog_post", postId, {
      slug: input.slug,
      status,
      hasHindi: Boolean(input.titleHi || input.contentHi),
    });
    refreshPublicContent("posts");
    revalidatePath("/admin/blog");
    revalidatePath(`/admin/blog/${postId}`);

    if (!createdId) {
      const message =
        intent === "publish" ? "Post published." : intent === "unpublish" ? "Post unpublished." : "Changes saved.";
      return { ok: true, message };
    }
  } catch (err) {
    if (uploadedUrl) await removePublicImage(uploadedUrl);
    return { ...failure(err), values };
  }

  redirect(`/admin/blog/${createdId}?created=1`);
}

export async function deletePost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = idSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Invalid post." };
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .delete()
      .eq("id", parsed.data.id)
      .select("id, slug, cover_image_url")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, message: "This post no longer exists." };
    await removePublicImage(data.cover_image_url);
    await audit(user.id, "post.deleted", "blog_post", data.id, { slug: data.slug });
    refreshPublicContent("posts");
    revalidatePath("/admin/blog");
  } catch (err) {
    return failure(err);
  }
  redirect("/admin/blog?deleted=1");
}

// ---------------------------------------------------------------------------
// Blog categories
// ---------------------------------------------------------------------------

export async function saveBlogCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = blogCategorySchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  const { id, name } = parsed.data;
  const nameHi = parsed.data.nameHi ?? null;
  const slug = parsed.data.slug ?? slugify(name);
  if (slug.length < 2) {
    return { ok: false, message: "Please correct the highlighted fields.", fieldErrors: { slug: ["Enter a slug"] }, values };
  }
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data, error } = id
      ? await supabase.from("blog_categories").update({ name, slug, name_hi: nameHi }).eq("id", id).select("id").maybeSingle()
      : await supabase.from("blog_categories").insert({ name, slug, name_hi: nameHi }).select("id").single();
    if (isUniqueViolation(error)) {
      return { ok: false, message: "That slug is already used.", fieldErrors: { slug: ["Choose a different slug"] }, values };
    }
    if (error) throw error;
    if (!data) return { ok: false, message: "This category no longer exists." };
    await audit(user.id, id ? "blog_category.updated" : "blog_category.created", "blog_category", data.id, {
      name,
      slug,
      nameHi,
    });
    refreshPublicContent("posts");
    revalidatePath("/admin/blog/categories");
    return { ok: true, message: id ? "Category updated." : "Category created." };
  } catch (err) {
    return { ...failure(err), values };
  }
}

export async function deleteBlogCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = idSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Invalid category." };
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("blog_categories")
      .delete()
      .eq("id", parsed.data.id)
      .select("id, name")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, message: "This category no longer exists." };
    await audit(user.id, "blog_category.deleted", "blog_category", data.id, { name: data.name });
    refreshPublicContent("posts");
    revalidatePath("/admin/blog/categories");
    revalidatePath("/admin/blog");
    return { ok: true, message: "Category deleted. Its posts are now uncategorised." };
  } catch (err) {
    return failure(err);
  }
}

// ---------------------------------------------------------------------------
// Blog tags (created from the post editor; only the Hindi name is edited here)
// ---------------------------------------------------------------------------

export async function saveBlogTagHindi(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = blogTagHindiSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  const nameHi = parsed.data.nameHi ?? null;
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("blog_tags")
      .update({ name_hi: nameHi })
      .eq("id", parsed.data.id)
      .select("id, name")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, message: "This tag no longer exists." };
    await audit(user.id, "blog_tag.updated", "blog_tag", data.id, { name: data.name, nameHi });
    refreshPublicContent("posts");
    revalidatePath("/admin/blog/categories");
    return { ok: true, message: nameHi ? `Hindi name saved for "${data.name}".` : `Hindi name cleared for "${data.name}".` };
  } catch (err) {
    return { ...failure(err), values };
  }
}
