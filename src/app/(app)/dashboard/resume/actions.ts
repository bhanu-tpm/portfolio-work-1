"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth/dal";
import {
  UserFacingError,
  failure,
  formValues,
  validationFailure,
  type ActionState,
} from "@/lib/action-result";
import { getSettings } from "@/lib/settings";
import { BUCKETS, buildObjectPath, removeObjects, uploadObject, validateUpload } from "@/lib/storage";
import { isAiFeatureEnabled, runAiFeature } from "@/lib/ai/run";
import { reviewResume } from "@/lib/ai/features";
import { checkResumeText } from "@/lib/ai/student-helpers";
import {
  deleteResumeReviews,
  extractPdfText,
  removeResumeFile,
  resumeReviewsInLastDay,
} from "@/lib/ai/resume-service";
import { idSchema, resumeReviewSchema } from "@/lib/validation/student-ai";

async function resumeReviewAvailable() {
  if (!(await isAiFeatureEnabled("resume_review"))) return false;
  const supabase = await createClient();
  const { count } = await supabase
    .from("consultation_categories")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("resume_review_enabled", true);
  return (count ?? 0) > 0;
}

export async function submitResumeReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  // Never echo the resume text back into the form state.
  const { pastedText: _omit, ...echo } = values;
  void _omit;
  const parsed = resumeReviewSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, echo);

  try {
    const user = await assertUser();
    if (!(await resumeReviewAvailable())) {
      throw new UserFacingError("AI resume review is currently unavailable.");
    }
    const input = parsed.data;
    const supabase = await createClient();

    // Optional link to one of the user's own requests.
    if (input.requestId) {
      const { data: request } = await supabase
        .from("consultation_requests")
        .select("id")
        .eq("id", input.requestId)
        .eq("client_id", user.id)
        .maybeSingle();
      if (!request) {
        return { ok: false, message: "Choose one of your requests.", fieldErrors: { requestId: ["Request not found"] }, values: echo };
      }
    }

    const upload = formData.get("resumeFile");
    const file = upload instanceof File && upload.size > 0 ? upload : null;
    if (file && input.pastedText) {
      return { ok: false, message: "Upload a PDF or paste text — not both.", values: echo };
    }
    if (!file && !input.pastedText) {
      return { ok: false, message: "Upload your resume as a PDF or paste its text.", fieldErrors: { pastedText: ["Provide a PDF or paste the text"] }, values: echo };
    }

    // Validate and extract before storing anything.
    const validated = file ? await validateUpload(file, ["pdf"]) : null;
    const rawText = validated ? await extractPdfText(validated.bytes) : input.pastedText!;
    const checked = checkResumeText(rawText, validated ? "pdf" : "text");
    if (!checked.ok) {
      return {
        ok: false,
        message: checked.message,
        fieldErrors: validated ? { resumeFile: [checked.message] } : { pastedText: [checked.message] },
        values: echo,
      };
    }

    const settings = await getSettings("ai");
    if ((await resumeReviewsInLastDay(user.id)) >= settings.resumeDailyLimit) {
      throw new UserFacingError(
        `You can request up to ${settings.resumeDailyLimit} resume review${settings.resumeDailyLimit === 1 ? "" : "s"} per day. Please try again tomorrow.`,
      );
    }

    const admin = createAdminClient();

    // Keep the original PDF in the private bucket (owner-only download via /api/files/<id>).
    let fileId: string | null = null;
    if (validated) {
      const path = buildObjectPath(user.id, "resumes", validated.originalName);
      await uploadObject(BUCKETS.resumes, path, validated);
      const { data: fileRow, error: fileError } = await admin
        .from("files")
        .insert({
          bucket: BUCKETS.resumes,
          path,
          owner_id: user.id,
          purpose: "resume",
          original_name: validated.originalName,
          mime_type: validated.mimeType,
          size_bytes: validated.size,
          uploaded_by: user.id,
        })
        .select("id")
        .single();
      if (fileError || !fileRow) {
        await removeObjects(BUCKETS.resumes, [path]);
        throw fileError ?? new Error("File insert failed");
      }
      fileId = fileRow.id as string;
    }

    const { data: review, error: reviewError } = await admin
      .from("resume_reviews")
      .insert({
        user_id: user.id,
        request_id: input.requestId ?? null,
        file_id: fileId,
        target_role: input.targetRole ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (reviewError || !review) {
      if (fileId) await removeResumeFile(fileId, user.id);
      throw reviewError ?? new Error("Review insert failed");
    }

    const outcome = await runAiFeature(
      {
        feature: "resume_review",
        userId: user.id,
        requestId: input.requestId ?? null,
        dailyLimit: settings.resumeDailyLimit,
      },
      (provider, model) =>
        reviewResume(provider, model, {
          resumeText: checked.text,
          targetRole: input.targetRole ?? null,
          userName: user.profile?.full_name,
        }),
    );

    // The extracted text is never stored: only the structured feedback.
    if (outcome.ok) {
      await admin
        .from("resume_reviews")
        .update({ status: "succeeded", feedback: outcome.data, ai_run_id: outcome.runId || null })
        .eq("id", review.id);
    } else {
      await admin
        .from("resume_reviews")
        .update({ status: "failed", error_message: outcome.message, ai_run_id: outcome.runId ?? null })
        .eq("id", review.id);
    }

    revalidatePath("/dashboard/resume");
    if (!outcome.ok) return { ok: false, message: outcome.message, values: echo };
    return {
      ok: true,
      message: checked.truncated
        ? "Your feedback is ready. Your resume was long, so only the first part was reviewed."
        : "Your feedback is ready.",
      data: { reviewId: review.id },
    };
  } catch (err) {
    return { ...failure(err), values: echo };
  }
}

export async function deleteResumeReview(id: string): Promise<ActionState> {
  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, message: "Review not found." };
  try {
    const user = await assertUser();
    const deleted = await deleteResumeReviews(user.id, [parsed.data.id]);
    if (deleted === 0) throw new UserFacingError("Review not found.");
    revalidatePath("/dashboard/resume");
    return { ok: true, message: "The review and its uploaded file were deleted." };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteAllResumeReviews(): Promise<ActionState> {
  try {
    const user = await assertUser();
    const deleted = await deleteResumeReviews(user.id);
    revalidatePath("/dashboard/resume");
    revalidatePath("/dashboard/settings");
    return {
      ok: true,
      message: deleted === 0 ? "You have no resume reviews." : `Deleted ${deleted} resume review${deleted === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    return failure(err);
  }
}
