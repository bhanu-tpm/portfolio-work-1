import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import type { ConsultationRequest } from "@/lib/db/types";
import { analyzeIntake } from "./features";
import { runAiFeature, type AiRunOutcome } from "./run";
import type { IntakeAnalysis } from "./schemas";

/**
 * Generates (or regenerates) the private AI preparation brief for a request.
 * The original submission is never modified; output goes to ai_generations.
 * Safe to call in the background: failures are recorded, never thrown.
 */
export async function generateIntakeAnalysis(
  requestId: string,
  actorId: string,
): Promise<AiRunOutcome<IntakeAnalysis> & { generationId?: string }> {
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("consultation_requests")
    .select("*, category:consultation_categories(title)")
    .eq("id", requestId)
    .maybeSingle<ConsultationRequest & { category: { title: string } | null }>();
  if (!request) return { ok: false, code: "provider_error", message: "Request not found." };
  if (!request.consent_ai) {
    return { ok: false, code: "disabled", message: "The client did not consent to AI-assisted preparation." };
  }

  const settings = await getSettings("ai");
  const outcome = await runAiFeature(
    { feature: "intake_analysis", userId: actorId, requestId, dailyLimit: settings.adminDailyLimit },
    (provider, model) => analyzeIntake(provider, model, request, request.category?.title ?? null),
  );
  if (!outcome.ok) return outcome;

  // Earlier analyses are kept for history but marked dismissed so only one is current.
  await admin
    .from("ai_generations")
    .update({ status: "dismissed" })
    .eq("request_id", requestId)
    .eq("feature", "intake_analysis")
    .neq("status", "dismissed");

  const { data: generation, error } = await admin
    .from("ai_generations")
    .insert({
      feature: "intake_analysis",
      ai_run_id: outcome.runId || null,
      request_id: requestId,
      content: outcome.data,
      status: "generated",
      created_by: actorId,
    })
    .select("id")
    .single();
  if (error) console.error("[ai] could not store intake analysis", error.message);
  return { ...outcome, generationId: generation?.id };
}
