import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { env, isAiConfigured } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSettings, type AiSettings } from "@/lib/settings";
import type { AiFeature } from "@/lib/db/types";
import { AiError, getAiProvider, type AiProvider, type AiUsage, type StructuredResult } from "./provider";

const FEATURE_FLAG: Record<AiFeature, keyof AiSettings> = {
  intake_analysis: "intakeAnalysis",
  outcome_draft: "outcomeDraft",
  resource_suggestions: "resourceSuggestions",
  career_assistant: "careerAssistant",
  resume_review: "resumeReview",
};

export interface AiRunContext {
  feature: AiFeature;
  userId: string;
  requestId?: string | null;
  outcomeId?: string | null;
  /** Per-user daily limit for this call. */
  dailyLimit: number;
}

export type AiRunOutcome<T> =
  | { ok: true; data: T; runId: string; model: string; citations: string[] }
  | { ok: false; code: AiError["code"]; message: string; runId?: string };

export function estimateCostUsd(usage: AiUsage) {
  const cost =
    (usage.inputTokens / 1_000_000) * env.aiInputPricePerMTok() +
    (usage.outputTokens / 1_000_000) * env.aiOutputPricePerMTok();
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Is this feature usable right now (configured + enabled)? Cheap check for UI. */
export async function isAiFeatureEnabled(feature: AiFeature) {
  if (!isAiConfigured()) return false;
  const settings = await getSettings("ai");
  return Boolean(settings[FEATURE_FLAG[feature]]);
}

/**
 * Runs an AI task with feature flags, budget, rate limits and usage tracking.
 * Never throws: callers get a typed failure they can show to the user while
 * the surrounding workflow continues.
 */
export async function runAiFeature<T>(
  ctx: AiRunContext,
  task: (provider: AiProvider, model: string) => Promise<StructuredResult<T>>,
): Promise<AiRunOutcome<T>> {
  const fail = (err: AiError, runId?: string): AiRunOutcome<T> => ({
    ok: false,
    code: err.code,
    message: err.userMessage,
    runId,
  });

  if (!isAiConfigured()) return fail(new AiError("not_configured"));
  const settings = await getSettings("ai");
  if (!settings[FEATURE_FLAG[ctx.feature]]) return fail(new AiError("disabled"));

  const admin = createAdminClient();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data: spent } = await admin.rpc("ai_cost_since", { since: monthStart.toISOString() });
  if (settings.monthlyBudgetUsd > 0 && Number(spent ?? 0) >= settings.monthlyBudgetUsd) {
    return fail(new AiError("budget_exceeded"));
  }

  if (!(await checkRateLimit(`ai:${ctx.feature}:${ctx.userId}`, ctx.dailyLimit, 86_400))) {
    return fail(new AiError("rate_limited"));
  }

  const model = settings.model || env.aiModel();
  const { data: run } = await admin
    .from("ai_runs")
    .insert({
      feature: ctx.feature,
      status: "pending",
      model,
      user_id: ctx.userId,
      request_id: ctx.requestId ?? null,
      outcome_id: ctx.outcomeId ?? null,
    })
    .select("id")
    .single();
  const runId: string | undefined = run?.id;

  const started = Date.now();
  try {
    const result = await task(getAiProvider(), model);
    if (runId) {
      await admin
        .from("ai_runs")
        .update({
          status: "succeeded",
          model: result.model,
          input_tokens: result.usage.inputTokens,
          output_tokens: result.usage.outputTokens,
          total_tokens: result.usage.totalTokens,
          estimated_cost_usd: estimateCostUsd(result.usage),
          latency_ms: Date.now() - started,
          attempts: result.attempts,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    return { ok: true, data: result.data, runId: runId ?? "", model: result.model, citations: result.citations };
  } catch (err) {
    const aiError = err instanceof AiError ? err : new AiError("provider_error", String(err));
    console.error(`[ai] ${ctx.feature} failed`, aiError.code, aiError.message);
    if (runId) {
      await admin
        .from("ai_runs")
        .update({
          status: "failed",
          error_code: aiError.code,
          error_message: aiError.message.slice(0, 1000),
          latency_ms: Date.now() - started,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    return fail(aiError, runId);
  }
}
