"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { refreshPublicContent } from "@/lib/admin-cache";
import { failure, formValues, validationFailure, type ActionState } from "@/lib/action-result";
import { portfolioItemSchema, siteProfileSchema } from "@/lib/validation/schemas";
import { idSchema, parseJsonField } from "@/lib/validation/content";
import { formFile, removePublicImage, uploadPublicImage } from "@/lib/content-media";

export async function saveSiteProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = siteProfileSchema.safeParse({
    ...values,
    socialLinks: parseJsonField(values.socialLinks, []),
    credibilityPoints: parseJsonField(values.credibilityPoints, []),
    credibilityPointsHi: parseJsonField(values.credibilityPointsHi, []),
  });
  if (!parsed.success) return validationFailure(parsed.error, values);
  const input = parsed.data;
  let uploadedUrl: string | null = null;

  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data: current } = await supabase.from("site_profile").select("photo_url").eq("id", 1).maybeSingle();

    const file = formFile(formData, "photoFile");
    if (file) uploadedUrl = (await uploadPublicImage(file, user.id, "profile")).url;
    const photoUrl = uploadedUrl ?? input.photoUrl ?? null;

    const { error } = await supabase.from("site_profile").upsert({
      id: 1,
      full_name: input.fullName,
      headline: input.headline,
      short_bio: input.shortBio,
      long_bio: input.longBio ?? "",
      approach: input.approach ?? "",
      photo_url: photoUrl,
      contact_email: input.contactEmail ?? null,
      contact_phone: input.contactPhone ?? null,
      location: input.location ?? null,
      social_links: input.socialLinks,
      credibility_points: input.credibilityPoints,
      headline_hi: input.headlineHi ?? null,
      short_bio_hi: input.shortBioHi ?? null,
      long_bio_hi: input.longBioHi ?? null,
      approach_hi: input.approachHi ?? null,
      location_hi: input.locationHi ?? null,
      credibility_points_hi: input.credibilityPointsHi,
    });
    if (error) throw error;

    if (current?.photo_url && current.photo_url !== photoUrl) await removePublicImage(current.photo_url);
    await audit(user.id, "site_profile.updated", "site_profile", null, {
      photoChanged: Boolean(uploadedUrl),
      hasHindi: Boolean(input.headlineHi || input.shortBioHi || input.longBioHi || input.approachHi),
    });
    refreshPublicContent("profile");
    revalidatePath("/admin/portfolio");
    return { ok: true, message: "Profile saved." };
  } catch (err) {
    if (uploadedUrl) await removePublicImage(uploadedUrl);
    return { ...failure(err), values };
  }
}

export async function savePortfolioItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = portfolioItemSchema.safeParse({ ...values, id: values.id || undefined });
  if (!parsed.success) return validationFailure(parsed.error, values);
  const { id, ...input } = parsed.data;
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const row = {
      kind: input.kind,
      title: input.title,
      subtitle: input.subtitle ?? null,
      description: input.description ?? null,
      period: input.period ?? null,
      title_hi: input.titleHi ?? null,
      subtitle_hi: input.subtitleHi ?? null,
      description_hi: input.descriptionHi ?? null,
      period_hi: input.periodHi ?? null,
      url: input.url ?? null,
      sort_order: input.sortOrder,
      is_visible: input.isVisible,
    };
    const { data, error } = id
      ? await supabase.from("portfolio_items").update(row).eq("id", id).select("id").maybeSingle()
      : await supabase.from("portfolio_items").insert(row).select("id").single();
    if (error) throw error;
    if (!data) return { ok: false, message: "This item no longer exists." };
    await audit(user.id, id ? "portfolio_item.updated" : "portfolio_item.created", "portfolio_item", data.id, {
      kind: input.kind,
      title: input.title,
    });
    refreshPublicContent("portfolio");
    revalidatePath("/admin/portfolio");
    return { ok: true, message: id ? "Item updated." : "Item added." };
  } catch (err) {
    return { ...failure(err), values };
  }
}

export async function deletePortfolioItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = idSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Invalid item." };
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("portfolio_items")
      .delete()
      .eq("id", parsed.data.id)
      .select("id, title")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, message: "This item no longer exists." };
    await audit(user.id, "portfolio_item.deleted", "portfolio_item", data.id, { title: data.title });
    refreshPublicContent("portfolio");
    revalidatePath("/admin/portfolio");
    return { ok: true, message: "Item deleted." };
  } catch (err) {
    return failure(err);
  }
}
