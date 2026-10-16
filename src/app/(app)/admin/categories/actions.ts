"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { refreshPublicContent } from "@/lib/admin-cache";
import { UserFacingError, failure, formValues, validationFailure, type ActionState } from "@/lib/action-result";
import { categoryFormSchema, idSchema, moveInOrder, moveSchema, parseJsonField, toggleSchema } from "@/lib/validation/content";

function refresh(id?: string) {
  refreshPublicContent("categories");
  revalidatePath("/admin/categories");
  if (id) revalidatePath(`/admin/categories/${id}`);
}

export async function saveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = categoryFormSchema.safeParse({
    ...values,
    id: values.id || undefined,
    formats: formData.getAll("formats").filter((f): f is string => typeof f === "string"),
    intakeQuestions: parseJsonField(values.intakeQuestions, []),
  });
  if (!parsed.success) return validationFailure(parsed.error, values);
  const { id, ...input } = parsed.data;
  let createdId: string | null = null;

  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const row = {
      slug: input.slug,
      title: input.title,
      short_description: input.shortDescription,
      scope: input.scope ?? "",
      title_hi: input.titleHi ?? null,
      short_description_hi: input.shortDescriptionHi ?? null,
      scope_hi: input.scopeHi ?? null,
      formats: input.formats,
      duration_minutes: input.durationMinutes,
      intake_questions: input.intakeQuestions,
      resume_review_enabled: input.resumeReviewEnabled,
      is_active: input.isActive,
    };

    let error: { code?: string } | null;
    let savedId: string | undefined;
    if (id) {
      const res = await supabase.from("consultation_categories").update(row).eq("id", id).select("id").maybeSingle();
      error = res.error;
      savedId = res.data?.id;
      if (!error && !savedId) return { ok: false, message: "This category no longer exists.", values };
    } else {
      const { data: last } = await supabase
        .from("consultation_categories")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const res = await supabase
        .from("consultation_categories")
        .insert({ ...row, sort_order: (last?.sort_order ?? -1) + 1 })
        .select("id")
        .single();
      error = res.error;
      savedId = res.data?.id;
      createdId = savedId ?? null;
    }
    if (error?.code === "23505") {
      return { ok: false, message: "That slug is already used.", fieldErrors: { slug: ["Choose a different slug"] }, values };
    }
    if (error || !savedId) throw error ?? new Error("Save failed");

    await audit(user.id, id ? "category.updated" : "category.created", "consultation_category", savedId, {
      slug: input.slug,
      isActive: input.isActive,
      hasHindi: Boolean(input.titleHi || input.shortDescriptionHi || input.scopeHi),
    });
    refresh(savedId);
    if (!createdId) return { ok: true, message: "Category saved." };
  } catch (err) {
    return { ...failure(err), values };
  }
  redirect(`/admin/categories/${createdId}?created=1`);
}

export async function setCategoryActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = toggleSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("consultation_categories")
      .update({ is_active: parsed.data.value })
      .eq("id", parsed.data.id)
      .select("id, title")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new UserFacingError("This category no longer exists.");
    await audit(user.id, parsed.data.value ? "category.enabled" : "category.disabled", "consultation_category", data.id, {
      title: data.title,
    });
    refresh(data.id);
    return { ok: true, message: parsed.data.value ? `"${data.title}" is now active.` : `"${data.title}" is disabled.` };
  } catch (err) {
    return failure(err);
  }
}

export async function moveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = moveSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("consultation_categories")
      .select("id, sort_order")
      .order("sort_order")
      .order("title");
    if (error) throw error;
    const rows = (data ?? []) as { id: string; sort_order: number }[];
    const order = moveInOrder(
      rows.map((r) => r.id),
      parsed.data.id,
      parsed.data.direction,
    );
    if (!order) return { ok: false, message: "This category can't move further." };

    // Normalise to 0..n-1 so duplicates from older data don't block moves.
    const current = new Map(rows.map((r) => [r.id, r.sort_order]));
    for (const [index, id] of order.entries()) {
      if (current.get(id) === index) continue;
      const { error: updateError } = await supabase.from("consultation_categories").update({ sort_order: index }).eq("id", id);
      if (updateError) throw updateError;
    }
    await audit(user.id, "category.reordered", "consultation_category", parsed.data.id, { direction: parsed.data.direction });
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = idSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Invalid category." };
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { count, error: countError } = await supabase
      .from("consultation_requests")
      .select("id", { count: "exact", head: true })
      .eq("category_id", parsed.data.id);
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      throw new UserFacingError(
        `This category is used by ${count} request(s). Disable it instead so existing requests keep their category.`,
      );
    }
    const { data, error } = await supabase
      .from("consultation_categories")
      .delete()
      .eq("id", parsed.data.id)
      .select("id, title")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new UserFacingError("This category no longer exists.");
    await audit(user.id, "category.deleted", "consultation_category", data.id, { title: data.title });
    refresh();
  } catch (err) {
    return failure(err);
  }
  redirect("/admin/categories?deleted=1");
}
