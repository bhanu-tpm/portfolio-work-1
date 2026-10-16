"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth/dal";
import { UserFacingError, failure, type ActionState } from "@/lib/action-result";
import { enforceRateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/email/notify";
import { handleAssistantTurn, type AssistantTurnResult } from "@/lib/ai/assistant-service";
import { buildSummaryMessage, canShareToRequest } from "@/lib/ai/student-helpers";
import { assistantMessageSchema, saveSummarySchema } from "@/lib/validation/student-ai";

export async function sendAssistantMessage(input: {
  conversationId?: string | null;
  message: string;
}): Promise<AssistantTurnResult> {
  const parsed = assistantMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your message." };
  }
  try {
    const user = await assertUser();
    return await handleAssistantTurn(user, parsed.data);
  } catch (err) {
    const f = failure(err, "The AI assistant couldn't respond. Please try again.");
    return { ok: false, message: f.message ?? "Something went wrong." };
  }
}

export async function giveAiConsent(): Promise<ActionState> {
  try {
    const user = await assertUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ ai_consent: true, ai_consent_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) throw error;
    revalidatePath("/dashboard/assistant");
    revalidatePath("/dashboard/settings");
    return { ok: true, message: "Thank you. You can start chatting now." };
  } catch (err) {
    return failure(err);
  }
}

export async function clearAssistantHistory(): Promise<ActionState> {
  try {
    const user = await assertUser();
    const supabase = await createClient();
    // Messages are removed by the ON DELETE CASCADE foreign key.
    const { error } = await supabase.from("ai_conversations").delete().eq("user_id", user.id);
    if (error) throw error;
    revalidatePath("/dashboard/assistant");
    revalidatePath("/dashboard/settings");
    return { ok: true, message: "Your AI assistant history has been deleted." };
  } catch (err) {
    return failure(err);
  }
}

export async function saveSummaryToRequest(input: {
  conversationId: string;
  requestId: string;
  summary: string;
  confirm: boolean;
}): Promise<ActionState> {
  const parsed = saveSummarySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the summary." };
  }
  try {
    const user = await assertUser();
    await enforceRateLimit(`message:${user.id}`, 30, 3600);
    const supabase = await createClient();

    const { data: conversation } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", parsed.data.conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!conversation) throw new UserFacingError("Conversation not found.");

    const { data: request } = await supabase
      .from("consultation_requests")
      .select("id, status, reference_code, client_id")
      .eq("id", parsed.data.requestId)
      .eq("client_id", user.id)
      .maybeSingle<{ id: string; status: string; reference_code: string; client_id: string }>();
    if (!request || request.client_id !== user.id) throw new UserFacingError("Request not found.");
    if (!canShareToRequest(request.status)) {
      throw new UserFacingError("This request is closed, so the summary can't be added to it.");
    }

    const body = buildSummaryMessage(parsed.data.summary);
    const { error } = await supabase.from("request_messages").insert({
      request_id: request.id,
      author_id: user.id,
      author_role: "client",
      body,
    });
    if (error) throw new UserFacingError("The summary couldn't be added to this request.");

    await supabase
      .from("ai_conversations")
      .update({ saved_to_request_id: request.id })
      .eq("id", conversation.id)
      .eq("user_id", user.id);

    after(() =>
      notify({
        type: "request.message",
        subject: `New message on ${request.reference_code}`,
        heading: "The client shared an AI guidance summary",
        paragraphs: [body],
        link: `/admin/requests/${request.id}`,
        linkLabel: "Open request",
        relatedRequestId: request.id,
      }),
    );
    revalidatePath(`/dashboard/requests/${request.id}`);
    return { ok: true, message: `Summary added to ${request.reference_code}.` };
  } catch (err) {
    return failure(err);
  }
}
