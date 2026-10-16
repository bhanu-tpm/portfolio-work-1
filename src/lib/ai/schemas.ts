import { z } from "zod";

// Model-facing schemas: every field required (strict structured outputs), no
// length constraints (enforced afterwards by `clamp*` helpers).

export const intakeAnalysisSchema = z.object({
  situationSummary: z.string(),
  educationCareerContext: z.string(),
  mainChallenges: z.array(z.string()),
  statedGoals: z.array(z.string()),
  keyQuestions: z.array(z.string()),
  missingInformation: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
  potentialTopics: z.array(z.string()),
  preparationChecklist: z.array(z.string()),
  assumptionsToAvoid: z.array(z.string()),
});
export type IntakeAnalysis = z.infer<typeof intakeAnalysisSchema>;

export const outcomeDraftSchema = z.object({
  overview: z.string(),
  goalsAndChallenges: z.string(),
  discussionPoints: z.string(),
  recommendations: z.string(),
  skillsAndResources: z.string(),
  actionPlan: z.string(),
  milestones: z.string(),
  followUp: z.string(),
});
export type OutcomeDraft = z.infer<typeof outcomeDraftSchema>;

export const sectionDraftSchema = z.object({ content: z.string() });

export const resourceSuggestionsSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      type: z.enum(["course", "learning_resource", "career_tool", "official_resource", "practice"]),
      description: z.string(),
      whyRelevant: z.string(),
      url: z.string().nullable(),
    }),
  ),
  caveats: z.array(z.string()),
});
export type ResourceSuggestions = z.infer<typeof resourceSuggestionsSchema>;

export interface VerifiedResource {
  title: string;
  type: ResourceSuggestions["items"][number]["type"];
  description: string;
  whyRelevant: string;
  url: string | null;
  verification: "cited_source" | "unverified_suggestion";
}

export const assistantTurnSchema = z.object({
  reply: z.string(),
  suggestedCategorySlugs: z.array(z.string()),
  suggestHumanConsultation: z.boolean(),
  conversationSummary: z.string(),
});
export type AssistantTurn = z.infer<typeof assistantTurnSchema>;

export const resumeFeedbackSchema = z.object({
  overallSummary: z.string(),
  strengths: z.array(z.string()),
  areas: z.array(
    z.object({
      area: z.enum([
        "structure_and_clarity",
        "skills_presentation",
        "achievement_descriptions",
        "target_role_alignment",
        "readability",
        "completeness",
      ]),
      observations: z.array(z.string()),
      suggestions: z.array(z.string()),
    }),
  ),
  suggestedRewrites: z.array(
    z.object({ original: z.string(), suggestion: z.string(), whatToVerify: z.string() }),
  ),
  missingInformation: z.array(z.string()),
});
export type ResumeFeedback = z.infer<typeof resumeFeedbackSchema>;

// ---------------------------------------------------------------------------
// Post-processing: bound sizes so a misbehaving model can't flood storage/UI.
// ---------------------------------------------------------------------------
export function clampText(value: string, max: number) {
  const v = value.trim();
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

export function clampList(values: string[], maxItems: number, maxLen = 400) {
  return values
    .map((v) => clampText(v, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}
