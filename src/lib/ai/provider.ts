import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { env } from "@/lib/env";
import { GeminiProvider } from "./gemini";

export type AiErrorCode =
  | "disabled"
  | "not_configured"
  | "rate_limited"
  | "budget_exceeded"
  | "timeout"
  | "provider_error"
  | "malformed_output"
  | "refused"
  | "moderation_blocked";

const USER_MESSAGES: Record<AiErrorCode, string> = {
  disabled: "This AI feature is currently turned off.",
  not_configured: "AI assistance is not configured on this site.",
  rate_limited: "The AI usage limit has been reached. Please try again later.",
  budget_exceeded: "The monthly AI budget has been reached. AI features resume next month.",
  timeout: "The AI service took too long to respond. Please try again.",
  provider_error: "The AI service is temporarily unavailable. Please try again later.",
  malformed_output: "The AI response could not be used. Please try again.",
  refused: "The AI service declined to answer this request.",
  moderation_blocked: "This message can't be processed by the assistant.",
};

export class AiError extends Error {
  readonly userMessage: string;
  constructor(
    readonly code: AiErrorCode,
    detail?: string,
  ) {
    super(detail ?? code);
    this.name = "AiError";
    this.userMessage = USER_MESSAGES[code];
  }
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface StructuredRequest<T> {
  /** Schema name sent to the model (letters, digits, underscores). */
  name: string;
  schema: z.ZodType<T>;
  /** Trusted instructions. Never interpolate untrusted text here. */
  system: string;
  /** Untrusted content, already wrapped/delimited by the caller. */
  input: string | { role: "user" | "assistant"; content: string }[];
  model: string;
  maxOutputTokens?: number;
  webSearch?: boolean;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  usage: AiUsage;
  attempts: number;
  /** URLs cited by the provider's web search tool, when used. */
  citations: string[];
}

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
}

export interface AiProvider {
  readonly name: string;
  generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
  moderate(text: string): Promise<ModerationResult>;
}

/** Subset of the OpenAI client used here, so tests can inject a fake. */
export interface OpenAILike {
  responses: { parse: (body: never, options?: never) => Promise<unknown> };
  moderations: { create: (body: never) => Promise<unknown> };
}

interface ParsedResponseLike {
  model?: string;
  output_parsed?: unknown;
  output?: {
    type: string;
    content?: { type: string; refusal?: string; annotations?: { type: string; url?: string }[] }[];
  }[];
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  incomplete_details?: { reason?: string } | null;
}

function mapProviderError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof OpenAI.APIConnectionTimeoutError) return new AiError("timeout");
  // A provider 429 is not the user's own daily limit ("rate_limited"), so it must not be reported as one.
  // insufficient_quota means the OpenAI account has no credits left: only the site owner can fix it.
  if (err instanceof OpenAI.RateLimitError) {
    return err.type === "insufficient_quota" || err.code === "insufficient_quota"
      ? new AiError("provider_error", `Provider quota exhausted (add OpenAI credits): ${err.message}`)
      : new AiError("provider_error", `Provider rate limit: ${err.message}`);
  }
  if (err instanceof OpenAI.AuthenticationError) return new AiError("not_configured", "Invalid API key");
  if (err instanceof OpenAI.APIError) return new AiError("provider_error", `${err.status ?? ""} ${err.message}`.trim());
  if (err instanceof Error && err.name === "AbortError") return new AiError("timeout");
  return new AiError("provider_error", err instanceof Error ? err.message : String(err));
}

export class OpenAIProvider implements AiProvider {
  readonly name = "openai";
  private readonly client: OpenAILike;

  constructor(client?: OpenAILike) {
    this.client =
      client ??
      (new OpenAI({
        apiKey: env.openaiApiKey(),
        timeout: env.aiTimeoutMs(),
        maxRetries: 2, // SDK retries connection errors, 408/409/429 and 5xx with backoff
      }) as unknown as OpenAILike);
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const usage: AiUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let lastError: AiError = new AiError("malformed_output");

    // One extra attempt for malformed/incomplete output; transport retries are handled by the SDK.
    for (let attempt = 1; attempt <= 2; attempt++) {
      let response: ParsedResponseLike;
      try {
        response = (await this.client.responses.parse({
          model: req.model,
          instructions: req.system,
          input: req.input,
          text: { format: zodTextFormat(req.schema, req.name) },
          max_output_tokens: req.maxOutputTokens ?? 8000,
          store: false,
          ...(req.webSearch ? { tools: [{ type: "web_search" }] } : {}),
        } as never)) as ParsedResponseLike;
      } catch (err) {
        throw mapProviderError(err);
      }

      usage.inputTokens += response.usage?.input_tokens ?? 0;
      usage.outputTokens += response.usage?.output_tokens ?? 0;
      usage.totalTokens += response.usage?.total_tokens ?? 0;

      const contents = (response.output ?? []).flatMap((o) => o.content ?? []);
      const refusal = contents.find((c) => c.type === "refusal");
      if (refusal) throw new AiError("refused", refusal.refusal);

      const validated = req.schema.safeParse(response.output_parsed);
      if (validated.success) {
        const citations = contents
          .flatMap((c) => c.annotations ?? [])
          .filter((a) => a.type === "url_citation" && a.url)
          .map((a) => a.url!);
        return {
          data: validated.data,
          model: response.model ?? req.model,
          usage,
          attempts: attempt,
          citations: [...new Set(citations)],
        };
      }
      lastError = new AiError(
        "malformed_output",
        response.incomplete_details?.reason
          ? `Incomplete output: ${response.incomplete_details.reason}`
          : validated.error.message.slice(0, 500),
      );
    }
    throw lastError;
  }

  async moderate(text: string): Promise<ModerationResult> {
    try {
      const res = (await this.client.moderations.create({
        model: "omni-moderation-latest",
        input: text,
      } as never)) as { results?: { flagged: boolean; categories: Record<string, boolean> }[] };
      const result = res.results?.[0];
      return {
        flagged: Boolean(result?.flagged),
        categories: Object.entries(result?.categories ?? {})
          .filter(([, v]) => v)
          .map(([k]) => k),
      };
    } catch (err) {
      throw mapProviderError(err);
    }
  }
}

let providerOverride: AiProvider | null = null;

/** Test hook. */
export function setAiProviderForTesting(provider: AiProvider | null) {
  providerOverride = provider;
}

export function getAiProvider(): AiProvider {
  if (providerOverride) return providerOverride;
  return env.aiProvider() === "gemini" ? new GeminiProvider() : new OpenAIProvider();
}
