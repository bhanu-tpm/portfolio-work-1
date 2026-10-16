"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth/dal";
import { adminNoteSchema, requestMessageSchema, updateRequestStatusSchema } from "@/lib/validation/schemas";
import { uuid } from "@/lib/validation/common";
import { UserFacingError, failure, formValues, validationFailure, type ActionState } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/email/notify";
import { requestStatusMeta } from "@/lib/format";
import { STATUS_REQUIRES_MESSAGE, canTransition } from "@/lib/workflow";
import { generateIntakeAnalysis } from "@/lib/ai/intake-service";
import { intakeAnalysisSchema } from "@/lib/ai/schemas";
import type { RequestStatus } from "@/lib/db/types";

function refresh(requestId: string) {
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin/requests");
}

export async function updateRequestStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = updateRequestStatusSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  const { requestId, status, clientMessage } = parsed.data;
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data: current } = await supabase
      .from("consultation_requests")
      .select("id, status, client_id, reference_code")
      .eq("id", requestId)
      .maybeSingle<{ id: string; status: RequestStatus; client_id: string; reference_code: string }>();
    if (!current) throw new UserFacingError("Request not found.");
    if (!canTransition(current.status, status)) {
      throw new UserFacingError(
        `A request can't move from "${requestStatusMeta[current.status].label}" to "${requestStatusMeta[status].label}".`,
      );
    }
    if (STATUS_REQUIRES_MESSAGE.includes(status) && !clientMessage) {
      return {
        ok: false,
        message: "Add a message so the client knows what to do next.",
        fieldErrors: { clientMessage: ["A message to the client is required for this status"] },
        values,
      };
    }

    const { error } = await supabase
      .from("consultation_requests")
      .update({ status, client_message: clientMessage ?? null })
      .eq("id", requestId);
    if (error) throw error;

    await audit(user.id, "request.status_changed", "consultation_request", requestId, {
      from: current.status,
      to: status,
    });

    const label = requestStatusMeta[status].label;
    after(() =>
      notify({
        type: status === "more_info_required" ? "request.more_info" : "request.status",
        userId: current.client_id,
        subject:
          status === "more_info_required"
            ? `More information needed for ${current.reference_code}`
            : `Your consultation request is now: ${label}`,
        heading: status === "more_info_required" ? "A little more information is needed" : `Status update: ${label}`,
        paragraphs: [
          requestStatusMeta[status].description,
          ...(clientMessage ? [`Message from the consultant:\n${clientMessage}`] : []),
          ...(status === "accepted" ? ["You can now choose an appointment time in your dashboard."] : []),
        ],
        link: `/dashboard/requests/${requestId}`,
        linkLabel: status === "accepted" ? "Book your appointment" : "View request",
        relatedRequestId: requestId,
      }),
    );
    refresh(requestId);
    return { ok: true, message: `Status changed to "${label}".` };
  } catch (err) {
    return { ...failure(err), values };
  }
}

export async function addAdminNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = adminNoteSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data: request } = await supabase
      .from("consultation_requests")
      .select("client_id")
      .eq("id", parsed.data.requestId)
      .maybeSingle();
    if (!request) throw new UserFacingError("Request not found.");
    const { error } = await supabase.from("admin_notes").insert({
      request_id: parsed.data.requestId,
      client_id: request.client_id,
      author_id: user.id,
      body: parsed.data.body,
    });
    if (error) throw error;
    refresh(parsed.data.requestId);
    return { ok: true, message: "Note saved." };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteAdminNote(formData: FormData) {
  const noteId = uuid.parse(formData.get("noteId"));
  const requestId = uuid.parse(formData.get("requestId"));
  const user = await assertAdmin();
  const supabase = await createClient();
  await supabase.from("admin_notes").delete().eq("id", noteId);
  await audit(user.id, "note.deleted", "admin_note", noteId);
  refresh(requestId);
}

export async function postAdminMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = requestMessageSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data: request } = await supabase
      .from("consultation_requests")
      .select("id, client_id, reference_code")
      .eq("id", parsed.data.requestId)
      .maybeSingle();
    if (!request) throw new UserFacingError("Request not found.");
    const { error } = await supabase.from("request_messages").insert({
      request_id: request.id,
      author_id: user.id,
      author_role: "admin",
      body: parsed.data.body,
    });
    if (error) throw error;
    after(() =>
      notify({
        type: "request.message",
        userId: request.client_id,
        subject: `New message about your request ${request.reference_code}`,
        heading: "You have a new message",
        paragraphs: [parsed.data.body],
        link: `/dashboard/requests/${request.id}`,
        linkLabel: "Reply",
        relatedRequestId: request.id,
      }),
    );
    refresh(request.id);
    return { ok: true, message: "Message sent." };
  } catch (err) {
    return failure(err);
  }
}

// ---------------------------------------------------------------------------
// AI intake analysis (private to the administrator)
// ---------------------------------------------------------------------------
export async function runIntakeAnalysis(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const requestId = uuid.parse(formData.get("requestId"));
    const user = await assertAdmin();
    const result = await generateIntakeAnalysis(requestId, user.id);
    refresh(requestId);
    if (!result.ok) return { ok: false, message: result.message };
    await audit(user.id, "ai.intake_analysis_generated", "consultation_request", requestId);
    return { ok: true, message: "AI analysis generated. Review it before relying on it." };
  } catch (err) {
    return failure(err);
  }
}

const editAnalysisSchema = z.object({
  generationId: uuid,
  requestId: uuid,
  content: z.string().max(50_000),
});

/** Saves administrator edits alongside (never over) the original AI output. */
export async function saveAnalysisEdits(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = editAnalysisSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const user = await assertAdmin();
    let edited: unknown;
    try {
      edited = JSON.parse(parsed.data.content);
    } catch {
      throw new UserFacingError("The edited analysis could not be read.");
    }
    const content = intakeAnalysisSchema.parse(edited);
    const supabase = await createClient();
    const { error } = await supabase
      .from("ai_generations")
      .update({ edited_content: content, status: "edited" })
      .eq("id", parsed.data.generationId)
      .eq("request_id", parsed.data.requestId);
    if (error) throw error;
    await audit(user.id, "ai.analysis_edited", "ai_generation", parsed.data.generationId);
    refresh(parsed.data.requestId);
    return { ok: true, message: "Edits saved. The original AI output is kept for reference." };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, message: "Some fields are invalid." };
    return failure(err);
  }
}

const reviewSchema = z.object({ generationId: uuid, requestId: uuid, decision: z.enum(["reviewed", "dismissed"]) });

export async function reviewAnalysis(formData: FormData) {
  const parsed = reviewSchema.parse(formValues(formData));
  const user = await assertAdmin();
  const supabase = await createClient();
  await supabase
    .from("ai_generations")
    .update({ status: parsed.decision, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.generationId)
    .eq("request_id", parsed.requestId);
  await audit(user.id, `ai.analysis_${parsed.decision}`, "ai_generation", parsed.generationId);
  refresh(parsed.requestId);
}
