import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the service-role Supabase client used by runAiFeature.
const inserted: Record<string, unknown>[] = [];
const updates: Record<string, unknown>[] = [];
let rateLimitAllowed = true;
let spent = 0;

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    rpc: async (fn: string) => {
      if (fn === "ai_cost_since") return { data: spent, error: null };
      if (fn === "consume_rate_limit") return { data: rateLimitAllowed, error: null };
      return { data: null, error: null };
    },
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return { select: () => ({ single: async () => ({ data: { id: "run-1" }, error: null }) }) };
      },
      update: (row: Record<string, unknown>) => {
        updates.push(row);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

vi.mock("@/lib/settings", () => ({
  getSettings: async () => ({
    intakeAnalysis: true,
    outcomeDraft: false,
    resourceSuggestions: true,
    careerAssistant: true,
    resumeReview: true,
    model: null,
    assistantDailyMessageLimit: 30,
    resumeDailyLimit: 3,
    adminDailyLimit: 200,
    monthlyBudgetUsd: 20,
  }),
}));

import { AiError, setAiProviderForTesting, type AiProvider } from "@/lib/ai/provider";
import { estimateCostUsd, runAiFeature } from "@/lib/ai/run";

const ctx = { feature: "intake_analysis" as const, userId: "u1", dailyLimit: 10 };
const okResult = { data: { x: 1 }, model: "m", usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 }, attempts: 1, citations: [] };

beforeEach(() => {
  inserted.length = 0;
  updates.length = 0;
  rateLimitAllowed = true;
  spent = 0;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-secret";
  process.env.AI_ENABLED = "true";
  setAiProviderForTesting({ name: "fake" } as AiProvider);
});

afterEach(() => setAiProviderForTesting(null));

describe("runAiFeature", () => {
  it("records a successful run with usage and cost", async () => {
    const result = await runAiFeature(ctx, async () => okResult);
    expect(result.ok).toBe(true);
    expect(inserted[0]).toMatchObject({ feature: "intake_analysis", status: "pending" });
    expect(updates[0]).toMatchObject({ status: "succeeded", input_tokens: 1000, output_tokens: 500 });
  });

  it("returns a friendly failure instead of throwing when the provider is down", async () => {
    const result = await runAiFeature(ctx, async () => {
      throw new AiError("provider_error", "503 upstream");
    });
    expect(result).toMatchObject({ ok: false, code: "provider_error" });
    if (!result.ok) expect(result.message).toMatch(/temporarily unavailable/);
    expect(updates[0]).toMatchObject({ status: "failed", error_code: "provider_error" });
  });

  it("treats unexpected exceptions as provider errors", async () => {
    const result = await runAiFeature(ctx, async () => {
      throw new TypeError("boom");
    });
    expect(result.ok).toBe(false);
  });

  it("does nothing when AI is disabled", async () => {
    process.env.AI_ENABLED = "false";
    const task = vi.fn();
    const result = await runAiFeature(ctx, task);
    expect(result).toMatchObject({ ok: false, code: "not_configured" });
    expect(task).not.toHaveBeenCalled();
  });

  it("respects per-feature switches", async () => {
    const task = vi.fn();
    const result = await runAiFeature({ ...ctx, feature: "outcome_draft" }, task);
    expect(result).toMatchObject({ ok: false, code: "disabled" });
    expect(task).not.toHaveBeenCalled();
  });

  it("enforces rate limits and the monthly budget before calling the model", async () => {
    const task = vi.fn();
    rateLimitAllowed = false;
    expect(await runAiFeature(ctx, task)).toMatchObject({ ok: false, code: "rate_limited" });
    rateLimitAllowed = true;
    spent = 25;
    expect(await runAiFeature(ctx, task)).toMatchObject({ ok: false, code: "budget_exceeded" });
    expect(task).not.toHaveBeenCalled();
  });
});

describe("estimateCostUsd", () => {
  it("uses configured per-million-token prices", () => {
    process.env.AI_INPUT_PRICE_PER_MTOK = "1";
    process.env.AI_OUTPUT_PRICE_PER_MTOK = "4";
    expect(estimateCostUsd({ inputTokens: 1_000_000, outputTokens: 500_000, totalTokens: 0 })).toBe(3);
  });
});
