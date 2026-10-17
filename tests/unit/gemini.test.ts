import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GeminiProvider } from "@/lib/ai/gemini";
import { AiError } from "@/lib/ai/provider";

const schema = z.object({ answer: z.string(), note: z.string().nullable() });
const req = { name: "test", schema, system: "sys", input: "hello", model: "gemini-test" };
const usageMetadata = { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2, totalTokenCount: 17 };

function reply(body: unknown, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

function answer(data: unknown, finishReason = "STOP") {
  return reply({
    candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: JSON.stringify(data) }] }, finishReason }],
    usageMetadata,
    modelVersion: "gemini-test-001",
  });
}

function provider(responses: Response[]) {
  const fetch = vi.fn();
  for (const r of responses) fetch.mockResolvedValueOnce(r);
  return { gemini: new GeminiProvider({ apiKey: "test-key", fetch, retryDelayMs: 0 }), fetch };
}

describe("GeminiProvider.generateStructured", () => {
  it("sends a JSON schema request and returns validated data, skipping thought parts", async () => {
    const { gemini, fetch } = provider([answer({ answer: "ok", note: null })]);
    const result = await gemini.generateStructured(req);
    expect(result.data).toEqual({ answer: "ok", note: null });
    expect(result.model).toBe("gemini-test-001");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 7, totalTokens: 17 });
    expect(result.citations).toEqual([]);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain("/models/gemini-test:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe("sys");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.$schema).toBeUndefined();
    expect(body.generationConfig.responseJsonSchema.required).toEqual(["answer", "note"]);
  });

  it("maps chat history roles to Gemini roles", async () => {
    const { gemini, fetch } = provider([answer({ answer: "ok", note: null })]);
    await gemini.generateStructured({
      ...req,
      input: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model"]);
  });

  it("retries once on invalid output and accumulates usage", async () => {
    const { gemini, fetch } = provider([answer({ answer: 42 }), answer({ answer: "ok", note: "n" })]);
    const result = await gemini.generateStructured(req);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
    expect(result.usage.totalTokens).toBe(34);
  });

  it("treats a safety block as a refusal", async () => {
    const { gemini } = provider([reply({ candidates: [{ finishReason: "SAFETY" }], usageMetadata })]);
    await expect(gemini.generateStructured(req)).rejects.toMatchObject({ code: "refused" });
  });

  it("retries a 429 and then reports it as a provider error, not the user's daily limit", async () => {
    const quota = () => reply({ error: { message: "Quota exceeded" } }, 429);
    const { gemini, fetch } = provider([quota(), quota(), quota()]);
    const err = await gemini.generateStructured(req).catch((e) => e);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("provider_error");
    expect(err.message).toMatch(/Quota exceeded/);
  });

  it("reports an invalid API key as not configured", async () => {
    const { gemini } = provider([reply({ error: { message: "API key not valid. Please pass a valid API key." } }, 400)]);
    await expect(gemini.generateStructured(req)).rejects.toMatchObject({ code: "not_configured" });
  });
});

describe("GeminiProvider.moderate", () => {
  it("returns the classifier's categories", async () => {
    const { gemini } = provider([answer({ flagged: true, categories: ["self-harm"] })]);
    expect(await gemini.moderate("text")).toEqual({ flagged: true, categories: ["self-harm"] });
  });

  it("does not flag when no category is given", async () => {
    const { gemini } = provider([answer({ flagged: true, categories: [] })]);
    expect((await gemini.moderate("text")).flagged).toBe(false);
  });

  it("flags a message that Google's safety filter blocks", async () => {
    const { gemini } = provider([reply({ promptFeedback: { blockReason: "SAFETY" } })]);
    expect((await gemini.moderate("text")).flagged).toBe(true);
  });
});
