"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth/dal";
import { consultationRequestSchema, requestMessageSchema } from "@/lib/validation/schemas";
import {
  UserFacingError,
  failure,
  formValues,
  validationFailure,
  type ActionState,
} from "@/lib/action-result";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseIntakeAnswers } from "@/lib/workflow";
import { BUCKETS, MAX_UPLOAD_BYTES, buildObjectPath, uploadObject, validateUpload, type ValidatedFile } from "@/lib/storage";
import { notify } from "@/lib/email/notify";
import { generateIntakeAnalysis } from "@/lib/ai/intake-service";
import { isAiFeatureEnabled } from "@/lib/ai/run";
import type { ConsultationCategory } from "@/lib/db/types";

const MAX_ATTACHMENTS = 3;

export async function submitConsultationRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  let created: { id: string; reference_code: string } | null = null;
  let uploadWarning = false;

  try {
    const user = await assertUser();
    const parsed = consultationRequestSchema.safeParse(values);

    const supabase = await createClient();
    const { data: category } = await supabase
      .from("consultation_categories")
      .select("*")
      .eq("id", parsed.success ? parsed.data.categoryId : values.categoryId ?? "")
      .eq("is_active", true)
      .maybeSingle<ConsultationCategory>();

    const { answers, errors: answerErrors } = parseIntakeAnswers(category?.intake_questions ?? [], (k) =>
      formData.get(k),
    );
    if (!parsed.success) {
      const failed = validationFailure(parsed.error, values);
      return { ...failed, fieldErrors: { ...failed.fieldErrors, ...answerErrors } };
    }
    if (Object.keys(answerErrors).length) {
      return { ok: false, message: "Please answer the required questions.", fieldErrors: answerErrors, values };
    }
    const input = parsed.data;
    if (!category) {
      return { ok: false, message: "Please choose an available consultation category.", fieldErrors: { categoryId: ["Choose a category"] }, values };
    }
    if (!category.formats.includes(input.preferredFormat)) {
      return { ok: false, message: "That format isn't offered for this category.", fieldErrors: { preferredFormat: ["Choose an available format"] }, values };
    }

    // Validate attachments before saving anything.
    const files = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_ATTACHMENTS) throw new UserFacingError(`Attach at most ${MAX_ATTACHMENTS} files.`);
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    if (totalSize > MAX_UPLOAD_BYTES) {
      throw new UserFacingError(`Attachments must total less than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
    }
    const validated: ValidatedFile[] = [];
    for (const file of files) validated.push(await validateUpload(file, ["pdf", "png", "jpeg", "docx"]));

    await enforceRateLimit(`request:${user.id}`, 5, 86_400, "You can submit up to 5 requests per day.");

    // Insert as the user so RLS enforces ownership and the initial status.
    const { data, error } = await supabase
      .from("consultation_requests")
      .insert({
        client_id: user.id,
        category_id: category.id,
        full_name: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        education_status: input.educationStatus,
        organization: input.organization ?? null,
        course: input.course ?? null,
        challenge: input.challenge,
        goals: input.goals,
        concerns: input.concerns ?? null,
        questions: input.questions,
        expected_outcomes: input.expectedOutcomes,
        preferred_format: input.preferredFormat,
        preferred_date: input.preferredDate ?? null,
        intake_answers: answers,
        consent_privacy: input.consentPrivacy,
        consent_ai: input.consentAi,
      })
      .select("id, reference_code")
      .single();
    if (error || !data) throw error ?? new Error("Insert failed");
    created = data;

    // Attachments: the request is already saved, so an upload failure only produces a warning.
    const admin = createAdminClient();
    for (const file of validated) {
      try {
        const path = buildObjectPath(user.id, `requests/${data.id}`, file.originalName);
        await uploadObject(BUCKETS.requestFiles, path, file);
        const { error: fileError } = await admin.from("files").insert({
          bucket: BUCKETS.requestFiles,
          path,
          owner_id: user.id,
          request_id: data.id,
          purpose: "request_attachment",
          original_name: file.originalName,
          mime_type: file.mimeType,
          size_bytes: file.size,
          uploaded_by: user.id,
        });
        if (fileError) throw fileError;
      } catch (err) {
        console.error("[request] attachment failed", err);
        uploadWarning = true;
      }
    }

    const requestId = data.id;
    const reference = data.reference_code;
    const consentAi = input.consentAi;
    after(async () => {
      await notify({
        type: "request.new",
        subject: `New consultation request ${reference}`,
        heading: "New consultation request",
        paragraphs: [`${input.fullName} submitted a request in "${category.title}".`, `Reference: ${reference}`],
        link: `/admin/requests/${requestId}`,
        linkLabel: "Review request",
        relatedRequestId: requestId,
      });
      await notify({
        type: "request.status",
        userId: user.id,
        subject: `We've received your consultation request (${reference})`,
        heading: "Your request has been received",
        paragraphs: [
          `Thank you for your request in "${category.title}". Your reference is ${reference}.`,
          "I'll review it and get back to you. You can track its status in your dashboard.",
        ],
        link: `/dashboard/requests/${requestId}`,
        linkLabel: "View request",
        relatedRequestId: requestId,
      });
      if (consentAi && (await isAiFeatureEnabled("intake_analysis"))) {
        await generateIntakeAnalysis(requestId, user.id);
      }
    });
  } catch (err) {
    return { ...failure(err), values };
  }

  if (!created) return { ok: false, message: "Something went wrong. Please try again.", values };
  revalidatePath("/dashboard/requests");
  redirect(`/dashboard/requests/${created.id}?submitted=1${uploadWarning ? "&uploadWarning=1" : ""}`);
}

export async function postClientMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = requestMessageSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const user = await assertUser();
    await enforceRateLimit(`message:${user.id}`, 30, 3600);
    const supabase = await createClient();
    const { data: request } = await supabase
      .from("consultation_requests")
      .select("id, status, reference_code, client_id")
      .eq("id", parsed.data.requestId)
      .maybeSingle();
    if (!request || request.client_id !== user.id) throw new UserFacingError("Request not found.");

    const { error } = await supabase.from("request_messages").insert({
      request_id: request.id,
      author_id: user.id,
      author_role: "client",
      body: parsed.data.body,
    });
    if (error) throw new UserFacingError("Messages can't be added to this request any more.");

    // A reply to a clarification request moves it back into review.
    if (request.status === "more_info_required") {
      await createAdminClient()
        .from("consultation_requests")
        .update({ status: "under_review", client_message: null })
        .eq("id", request.id);
    }

    after(() =>
      notify({
        type: "request.message",
        subject: `New message on ${request.reference_code}`,
        heading: "The client replied",
        paragraphs: [parsed.data.body],
        link: `/admin/requests/${request.id}`,
        linkLabel: "Open request",
        relatedRequestId: request.id,
      }),
    );
    revalidatePath(`/dashboard/requests/${request.id}`);
    return { ok: true, message: "Message sent." };
  } catch (err) {
    return failure(err);
  }
}
