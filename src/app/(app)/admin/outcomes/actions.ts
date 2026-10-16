"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth/dal";
import { uuid } from "@/lib/validation/common";
import { outcomeContentSchema } from "@/lib/validation/schemas";
import { UserFacingError, failure, formValues, validationFailure, type ActionState } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/email/notify";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { runAiFeature } from "@/lib/ai/run";
import { draftOutcome, regenerateOutcomeSection, suggestResources, type OutcomeDraftSources } from "@/lib/ai/features";
import type { IntakeAnalysis, VerifiedResource } from "@/lib/ai/schemas";
import { BUCKETS, buildObjectPath, uploadObject, validateUpload } from "@/lib/storage";
import { OUTCOME_SECTIONS, type AiGeneration, type ConsultationOutcome, type ConsultationRequest, type OutcomeContent } from "@/lib/db/types";

const EMPTY_CONTENT: OutcomeContent = {
  overview: "",
  goalsAndChallenges: "",
  discussionPoints: "",
  recommendations: "",
  skillsAndResources: "",
  actionPlan: "",
  milestones: "",
  followUp: "",
};

function refresh(outcomeId: string) {
  revalidatePath(`/admin/outcomes/${outcomeId}`);
  revalidatePath("/admin/outcomes");
}

async function loadOutcome(outcomeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consultation_outcomes")
    .select("*")
    .eq("id", outcomeId)
    .maybeSingle<ConsultationOutcome>();
  if (!data) throw new UserFacingError("Outcome not found.");
  return { supabase, outcome: data };
}

async function nextVersionNumber(outcomeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("outcome_versions")
    .select("version_number")
    .eq("outcome_id", outcomeId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version_number ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
const createSchema = z.object({
  requestId: uuid,
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  appointmentId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
});

export async function createOutcome(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = createSchema.safeParse(values);
  if (!parsed.success) return validationFailure(parsed.error, values);
  let outcomeId: string;
  try {
    const user = await assertAdmin();
    const supabase = await createClient();
    const { data: request } = await supabase
      .from("consultation_requests")
      .select("id, client_id, status")
      .eq("id", parsed.data.requestId)
      .maybeSingle();
    if (!request) throw new UserFacingError("Request not found.");
    if (parsed.data.appointmentId) {
      const { data: appt } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", parsed.data.appointmentId)
        .eq("request_id", request.id)
        .maybeSingle();
      if (!appt) throw new UserFacingError("That appointment doesn't belong to this request.");
    }
    const { data: outcome, error } = await supabase
      .from("consultation_outcomes")
      .insert({
        request_id: request.id,
        client_id: request.client_id,
        appointment_id: parsed.data.appointmentId ?? null,
        title: parsed.data.title,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !outcome) throw error ?? new Error("Insert failed");
    const { error: versionError } = await supabase.from("outcome_versions").insert({
      outcome_id: outcome.id,
      version_number: 1,
      content: EMPTY_CONTENT,
      source: "manual",
      change_note: "Created",
      created_by: user.id,
    });
    if (versionError) throw versionError;
    await audit(user.id, "outcome.created", "consultation_outcome", outcome.id, { request_id: request.id });
    outcomeId = outcome.id;
  } catch (err) {
    return { ...failure(err), values };
  }
  redirect(`/admin/outcomes/${outcomeId}`);
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------
const saveSchema = z.object({
  outcomeId: uuid,
  content: z.string().max(120_000),
  changeNote: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(500).optional()),
  aiAssisted: z.preprocess((v) => v === "true", z.boolean()),
});

export async function saveOutcomeVersion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = saveSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const user = await assertAdmin();
    const { supabase, outcome } = await loadOutcome(parsed.data.outcomeId);
    if (!["draft", "approved"].includes(outcome.status)) {
      throw new UserFacingError("Published outcomes can't be edited. Create a new outcome to supersede it.");
    }
    let content: OutcomeContent;
    try {
      content = outcomeContentSchema.parse(JSON.parse(parsed.data.content));
    } catch {
      throw new UserFacingError("The outcome content is invalid or too long.");
    }
    const version = await nextVersionNumber(outcome.id);
    const { error } = await supabase.from("outcome_versions").insert({
      outcome_id: outcome.id,
      version_number: version,
      content,
      source: parsed.data.aiAssisted ? "ai_assisted" : "manual",
      change_note: parsed.data.changeNote ?? null,
      created_by: user.id,
    });
    if (error) throw error;
    await audit(user.id, "outcome.version_saved", "consultation_outcome", outcome.id, { version });
    refresh(outcome.id);
    return {
      ok: true,
      message:
        outcome.status === "approved"
          ? `Saved as version ${version}. The previous approval was withdrawn — review and approve again.`
          : `Saved as version ${version}.`,
    };
  } catch (err) {
    return failure(err);
  }
}

// ---------------------------------------------------------------------------
// AI drafting (never approves or publishes anything)
// ---------------------------------------------------------------------------
const draftSchema = z.object({
  outcomeId: uuid,
  includeRequirements: z.preprocess((v) => v === "on", z.boolean()),
  includePreparation: z.preprocess((v) => v === "on", z.boolean()),
  includeCurrentDraft: z.preprocess((v) => v === "on", z.boolean()),
  sessionNotes: z.string().max(20_000).default(""),
  recommendations: z.string().max(10_000).default(""),
  section: z.preprocess((v) => (v === "" ? undefined : v), z.enum(OUTCOME_SECTIONS.map((s) => s.key) as [string, ...string[]]).optional()),
  sectionInstructions: z.string().max(2000).default(""),
  currentDraft: z.string().max(120_000).default(""),
});

async function buildDraftSources(
  outcome: ConsultationOutcome,
  input: z.infer<typeof draftSchema>,
  selectedNoteIds: string[],
): Promise<{ sources: OutcomeDraftSources; consentAi: boolean }> {
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("consultation_requests")
    .select("*, category:consultation_categories(title)")
    .eq("id", outcome.request_id)
    .maybeSingle<ConsultationRequest & { category: { title: string } | null }>();
  if (!request) throw new UserFacingError("Request not found.");

  const sources: OutcomeDraftSources = { clientName: request.full_name, categoryTitle: request.category?.title ?? null };

  if (input.includeRequirements) {
    sources.requirements = [
      `Status: ${request.education_status}`,
      request.course ? `Course: ${request.course}` : "",
      `Challenge: ${request.challenge}`,
      `Goals: ${request.goals}`,
      request.concerns ? `Concerns: ${request.concerns}` : "",
      `Questions: ${request.questions}`,
      `Expected outcomes: ${request.expected_outcomes}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (input.includePreparation) {
    const { data: prep } = await supabase
      .from("ai_generations")
      .select("content, edited_content")
      .eq("request_id", request.id)
      .eq("feature", "intake_analysis")
      .neq("status", "dismissed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<Pick<AiGeneration<IntakeAnalysis>, "content" | "edited_content">>();
    const a = prep?.edited_content ?? prep?.content;
    if (a) {
      sources.preparationSummary = [a.situationSummary, ...a.mainChallenges.map((c) => `- ${c}`), ...a.keyQuestions.map((q) => `- ${q}`)].join("\n");
    }
  }
  // Private notes are sent only when the administrator explicitly ticks them.
  const notes: string[] = [];
  if (selectedNoteIds.length) {
    const { data } = await supabase
      .from("admin_notes")
      .select("body")
      .eq("request_id", request.id)
      .in("id", selectedNoteIds);
    notes.push(...(data ?? []).map((n) => n.body));
  }
  if (input.sessionNotes.trim()) notes.push(input.sessionNotes.trim());
  if (notes.length) sources.sessionNotes = notes.join("\n\n");
  if (input.recommendations.trim()) sources.selectedRecommendations = input.recommendations.trim();
  if (input.includeCurrentDraft && input.currentDraft) {
    try {
      sources.currentDraft = outcomeContentSchema.parse(JSON.parse(input.currentDraft));
    } catch {
      /* ignore malformed editor state */
    }
  }
  return { sources, consentAi: request.consent_ai };
}

export async function generateOutcomeDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = draftSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  const noteIds = formData.getAll("noteIds").filter((v): v is string => typeof v === "string" && uuid.safeParse(v).success);
  try {
    const user = await assertAdmin();
    const { supabase, outcome } = await loadOutcome(parsed.data.outcomeId);
    if (!["draft", "approved"].includes(outcome.status)) throw new UserFacingError("This outcome can no longer be edited.");
    const { sources, consentAi } = await buildDraftSources(outcome, parsed.data, noteIds);
    if (!consentAi && (sources.requirements || sources.preparationSummary)) {
      throw new UserFacingError(
        "The client did not consent to AI processing of their submission. Untick the client's requirements and preparation summary, or write the outcome manually.",
      );
    }
    if (!sources.requirements && !sources.sessionNotes && !sources.preparationSummary && !sources.selectedRecommendations) {
      throw new UserFacingError("Select at least one source of information for the draft.");
    }
    const settings = await getSettings("ai");
    const ctx = { feature: "outcome_draft" as const, userId: user.id, requestId: outcome.request_id, outcomeId: outcome.id, dailyLimit: settings.adminDailyLimit };

    // Single-section regeneration returns text to the editor; nothing is saved.
    if (parsed.data.section) {
      const section = parsed.data.section as keyof OutcomeContent;
      const result = await runAiFeature(ctx, (p, m) =>
        regenerateOutcomeSection(p, m, sources, section, parsed.data.sectionInstructions || undefined),
      );
      if (!result.ok) return { ok: false, message: result.message };
      await createAdminClient().from("ai_generations").insert({
        feature: "outcome_draft",
        ai_run_id: result.runId || null,
        request_id: outcome.request_id,
        outcome_id: outcome.id,
        content: { section, content: result.data.content },
        created_by: user.id,
      });
      return { ok: true, message: "Section regenerated. Review it, then save a new version.", data: { section, content: result.data.content } };
    }

    const result = await runAiFeature(ctx, (p, m) => draftOutcome(p, m, sources));
    if (!result.ok) return { ok: false, message: result.message };

    const { data: generation } = await createAdminClient()
      .from("ai_generations")
      .insert({
        feature: "outcome_draft",
        ai_run_id: result.runId || null,
        request_id: outcome.request_id,
        outcome_id: outcome.id,
        content: result.data,
        created_by: user.id,
      })
      .select("id")
      .single();

    const version = await nextVersionNumber(outcome.id);
    const { error } = await supabase.from("outcome_versions").insert({
      outcome_id: outcome.id,
      version_number: version,
      content: result.data,
      source: "ai_draft",
      ai_generation_id: generation?.id ?? null,
      change_note: "AI-generated draft (unreviewed)",
      created_by: user.id,
    });
    if (error) throw error;
    await audit(user.id, "ai.outcome_draft_generated", "consultation_outcome", outcome.id, { version });
    refresh(outcome.id);
    return { ok: true, message: `AI draft saved as version ${version}. Review and edit it before approving.` };
  } catch (err) {
    return failure(err);
  }
}

const resourcesSchema = z.object({
  outcomeId: uuid,
  focus: z.string().trim().min(3, "Describe what resources you need").max(500),
});

export async function suggestOutcomeResources(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resourcesSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const user = await assertAdmin();
    const { outcome } = await loadOutcome(parsed.data.outcomeId);
    const supabase = await createClient();
    const { data: request } = await supabase
      .from("consultation_requests")
      .select("education_status, course, goals, consent_ai, category:consultation_categories(title)")
      .eq("id", outcome.request_id)
      .maybeSingle<{ education_status: string; course: string | null; goals: string; consent_ai: boolean; category: { title: string } | null }>();
    const context = request?.consent_ai
      ? [`Category: ${request.category?.title ?? "General"}`, `Status: ${request.education_status}`, request.course ? `Course: ${request.course}` : "", `Goals: ${request.goals}`]
          .filter(Boolean)
          .join("\n")
      : "No client details shared (client did not consent to AI processing).";
    const settings = await getSettings("ai");
    const webSearch = process.env.AI_WEB_SEARCH === "true";
    const result = await runAiFeature(
      { feature: "resource_suggestions", userId: user.id, requestId: outcome.request_id, outcomeId: outcome.id, dailyLimit: settings.adminDailyLimit },
      (p, m) => suggestResources(p, m, { focus: parsed.data.focus, context, webSearch }),
    );
    if (!result.ok) return { ok: false, message: result.message };
    await createAdminClient().from("ai_generations").insert({
      feature: "resource_suggestions",
      ai_run_id: result.runId || null,
      request_id: outcome.request_id,
      outcome_id: outcome.id,
      content: result.data,
      created_by: user.id,
    });
    return {
      ok: true,
      message: webSearch ? "Suggestions ready. Links shown only where cited by web search." : "Suggestions ready. Verify each resource before sharing.",
      data: result.data as unknown as { items: VerifiedResource[]; caveats: string[] },
    };
  } catch (err) {
    return failure(err);
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export async function uploadOutcomePdf(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const outcomeId = uuid.parse(formData.get("outcomeId"));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Choose a PDF file.");
    const user = await assertAdmin();
    const { supabase, outcome } = await loadOutcome(outcomeId);
    if (outcome.status !== "draft") {
      throw new UserFacingError("Documents can only be attached to drafts. Revoke approval first.");
    }
    const validated = await validateUpload(file, ["pdf"]);
    const { data: latest } = await supabase
      .from("outcome_versions")
      .select("id, version_number")
      .eq("outcome_id", outcome.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();
    if (!latest) throw new UserFacingError("Save a version first.");

    const path = buildObjectPath(outcome.client_id, `outcomes/${outcome.id}`, validated.originalName);
    await uploadObject(BUCKETS.outcomeDocuments, path, validated);
    const admin = createAdminClient();
    const { data: fileRow, error: fileError } = await admin
      .from("files")
      .insert({
        bucket: BUCKETS.outcomeDocuments,
        path,
        owner_id: outcome.client_id,
        request_id: outcome.request_id,
        purpose: "outcome_document",
        original_name: validated.originalName,
        mime_type: validated.mimeType,
        size_bytes: validated.size,
        uploaded_by: user.id,
      })
      .select("id")
      .single();
    if (fileError || !fileRow) throw fileError ?? new Error("File record failed");
    const { error } = await supabase.from("outcome_versions").update({ file_id: fileRow.id }).eq("id", latest.id);
    if (error) throw error;
    await audit(user.id, "outcome.document_uploaded", "consultation_outcome", outcome.id, {
      version: latest.version_number,
      file_id: fileRow.id,
    });
    refresh(outcome.id);
    return { ok: true, message: `PDF attached to version ${latest.version_number}.` };
  } catch (err) {
    return failure(err);
  }
}

// ---------------------------------------------------------------------------
// Approval and publication — explicit administrator actions only
// ---------------------------------------------------------------------------
const approveSchema = z.object({
  outcomeId: uuid,
  versionId: uuid,
  confirmReviewed: z.literal("on", { error: "Confirm that you have reviewed the content" }),
});

export async function approveOutcome(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = approveSchema.safeParse(formValues(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    await assertAdmin();
    const { supabase, outcome } = await loadOutcome(parsed.data.outcomeId);
    const { data: latest } = await supabase
      .from("outcome_versions")
      .select("id, content")
      .eq("outcome_id", outcome.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single<{ id: string; content: OutcomeContent }>();
    if (!latest || latest.id !== parsed.data.versionId) {
      throw new UserFacingError("Only the latest version can be approved. Reload the page and review it.");
    }
    if (!Object.values(latest.content).some((v) => v.trim())) {
      throw new UserFacingError("The outcome is empty.");
    }
    if (Object.values(latest.content).some((v) => v.includes("[Consultant to complete]"))) {
      throw new UserFacingError('Some sections still contain "[Consultant to complete]" placeholders.');
    }
    const { error } = await supabase.rpc("approve_outcome", {
      p_outcome_id: outcome.id,
      p_version_id: latest.id,
    });
    if (error) throw new UserFacingError(error.message);
    refresh(outcome.id);
    return { ok: true, message: "Approved. The client can't see it until you publish." };
  } catch (err) {
    return failure(err);
  }
}

export async function revokeApproval(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const outcomeId = uuid.parse(formData.get("outcomeId"));
    await assertAdmin();
    const supabase = await createClient();
    const { error } = await supabase.rpc("revoke_outcome_approval", { p_outcome_id: outcomeId });
    if (error) throw new UserFacingError(error.message);
    refresh(outcomeId);
    return { ok: true, message: "Approval withdrawn." };
  } catch (err) {
    return failure(err);
  }
}

export async function publishOutcome(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const outcomeId = uuid.parse(formData.get("outcomeId"));
    await assertAdmin();
    const { supabase, outcome } = await loadOutcome(outcomeId);
    const { error } = await supabase.rpc("publish_outcome", { p_outcome_id: outcome.id });
    if (error) throw new UserFacingError(error.message);

    // Close the request once its outcome is delivered.
    await supabase
      .from("consultation_requests")
      .update({ status: "completed", client_message: null })
      .eq("id", outcome.request_id)
      .eq("status", "accepted");

    after(() =>
      notify({
        type: "outcome.published",
        userId: outcome.client_id,
        subject: "Your consultation outcome is ready",
        heading: "Your consultation outcome is available",
        paragraphs: [
          `"${outcome.title}" has been published to your dashboard.`,
          "You can read it online and download it as a PDF.",
        ],
        link: `/dashboard/outcomes/${outcome.id}`,
        linkLabel: "View outcome",
        relatedOutcomeId: outcome.id,
        relatedRequestId: outcome.request_id,
      }),
    );
    refresh(outcome.id);
    revalidatePath(`/admin/requests/${outcome.request_id}`);
    return { ok: true, message: `Published. The client has been notified${env.resendApiKey() ? "" : " (email not configured)"}.` };
  } catch (err) {
    return failure(err);
  }
}

export async function archiveOutcome(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const outcomeId = uuid.parse(formData.get("outcomeId"));
    const user = await assertAdmin();
    const { supabase, outcome } = await loadOutcome(outcomeId);
    const { error } = await supabase.from("consultation_outcomes").update({ status: "archived" }).eq("id", outcome.id);
    if (error) throw new UserFacingError(error.message);
    await audit(user.id, "outcome.archived", "consultation_outcome", outcome.id, { from: outcome.status });
    refresh(outcome.id);
    return { ok: true, message: "Outcome archived." };
  } catch (err) {
    return failure(err);
  }
}
