import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { enforceRateLimit } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/action-result";
import type { CurrentUser } from "@/lib/auth/dal";
import { assistantTurn } from "./features";
import { getAiProvider } from "./provider";
import { isAiFeatureEnabled, runAiFeature } from "./run";
import {
  recentHistory,
  resolveSuggestedCategories,
  selectModerationResponse,
  type ChatMessage,
} from "./student-helpers";

export interface SuggestedCategory {
  id: string;
  title: string;
}

export type AssistantTurnResult =
  | {
      ok: true;
      conversationId: string | null;
      reply: string;
      suggestedCategories: SuggestedCategory[];
      suggestHumanConsultation: boolean;
      summary: string | null;
      /** The message was not sent to the model (moderation) and was not stored. */
      moderated: boolean;
    }
  | { ok: false; message: string };

const HISTORY_LIMIT = 16;

async function loadOwnedConversation(userId: string, conversationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_conversations")
    .select("id, user_id, title")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle<{ id: string; user_id: string; title: string }>();
  return data;
}

/**
 * One career-assistant turn. Callers must have authenticated the user.
 * Order: feature flag → consent → ownership → moderation → AI (limits, usage) → persistence.
 */
export async function handleAssistantTurn(
  user: CurrentUser,
  input: { conversationId?: string | null; message: string },
): Promise<AssistantTurnResult> {
  if (!(await isAiFeatureEnabled("career_assistant"))) {
    return { ok: false, message: "AI career guidance is currently unavailable. You can still book a consultation." };
  }
  if (!user.profile?.ai_consent) {
    throw new UserFacingError("Please agree to the AI assistant terms before chatting.");
  }

  const supabase = await createClient();
  let conversationId: string | null = null;
  let history: ChatMessage[] = [];
  if (input.conversationId) {
    const conversation = await loadOwnedConversation(user.id, input.conversationId);
    if (!conversation) throw new UserFacingError("This conversation could not be found. Please start a new one.");
    conversationId = conversation.id;
    const { data: rows } = await supabase
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversation.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    history = ((rows ?? []) as ChatMessage[]).reverse().map((m) => ({ role: m.role, content: m.content }));
  }

  const settings = await getSettings("ai");
  // Moderation is a paid call too: bound it separately from the model limit.
  await enforceRateLimit(
    `assistant-moderation:${user.id}`,
    Math.max(1, settings.assistantDailyMessageLimit * 2),
    86_400,
    "You've reached today's AI assistant limit. Please try again tomorrow.",
  );

  let flaggedCategories: string[] | null = null;
  try {
    const moderation = await getAiProvider().moderate(input.message);
    if (moderation.flagged) flaggedCategories = moderation.categories;
  } catch (err) {
    console.error("[assistant] moderation failed", err instanceof Error ? err.message : err);
    return { ok: false, message: "The AI assistant is temporarily unavailable. Please try again later." };
  }

  if (flaggedCategories) {
    // Nothing is sent to the model and nothing is stored.
    const safe = selectModerationResponse(flaggedCategories);
    return {
      ok: true,
      conversationId,
      reply: safe.reply,
      suggestedCategories: [],
      suggestHumanConsultation: !safe.crisis,
      summary: null,
      moderated: true,
    };
  }

  const { data: categoryRows } = await supabase
    .from("consultation_categories")
    .select("id, slug, title")
    .eq("is_active", true)
    .order("sort_order");
  const categories = (categoryRows ?? []) as { id: string; slug: string; title: string }[];

  const outcome = await runAiFeature(
    { feature: "career_assistant", userId: user.id, dailyLimit: settings.assistantDailyMessageLimit },
    (provider, model) =>
      assistantTurn(provider, model, {
        history: recentHistory([...history, { role: "user", content: input.message }], HISTORY_LIMIT),
        categories: categories.map((c) => ({ slug: c.slug, title: c.title })),
        userName: user.profile?.full_name,
      }),
  );
  if (!outcome.ok) {
    const message =
      outcome.code === "rate_limited"
        ? "You've reached today's AI assistant limit. Please try again tomorrow, or book a consultation."
        : outcome.message;
    return { ok: false, message };
  }

  // Persist. The conversation is created as the user (RLS); messages have no
  // client insert policy, so they are written with the service role after the
  // ownership checks above.
  if (!conversationId) {
    const { data: created, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: user.id, title: "Career guidance", summary: outcome.data.conversationSummary || null })
      .select("id")
      .single();
    if (error || !created) {
      console.error("[assistant] conversation insert failed", error?.message);
      throw new Error("Could not create conversation");
    }
    conversationId = created.id as string;
  } else {
    // Stores the latest summary and touches updated_at (retention is measured from the last activity).
    await supabase
      .from("ai_conversations")
      .update({ title: "Career guidance", summary: outcome.data.conversationSummary || null })
      .eq("id", conversationId)
      .eq("user_id", user.id);
  }

  const now = Date.now();
  const { error: insertError } = await createAdminClient()
    .from("ai_messages")
    .insert([
      {
        conversation_id: conversationId,
        user_id: user.id,
        role: "user",
        content: input.message,
        created_at: new Date(now).toISOString(),
      },
      {
        conversation_id: conversationId,
        user_id: user.id,
        role: "assistant",
        content: outcome.data.reply,
        created_at: new Date(now + 1).toISOString(),
      },
    ]);
  if (insertError) console.error("[assistant] message insert failed", insertError.message);

  return {
    ok: true,
    conversationId,
    reply: outcome.data.reply,
    suggestedCategories: resolveSuggestedCategories(outcome.data.suggestedCategorySlugs, categories).map((c) => ({
      id: c.id,
      title: c.title,
    })),
    suggestHumanConsultation: outcome.data.suggestHumanConsultation,
    summary: outcome.data.conversationSummary || null,
    moderated: false,
  };
}
