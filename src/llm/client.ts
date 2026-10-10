/**
 * OpenCode Zen client. Zen exposes an OpenAI-compatible Chat Completions API,
 * so this is a thin, dependency-free fetch client with bounded retry/backoff.
 *
 * The agent layer depends on the {@link LLMClient} interface, which lets the
 * self-test suite inject a deterministic {@link MockLLMClient} with no network.
 */

import { ModelCallError, errorMessage, withRetry, type RetryOptions } from "../core/errors.ts";

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface ChatRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  /** Hint that the model should return a strict JSON object. */
  readonly json?: boolean;
}

export interface ChatUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
}

export interface ChatResponse {
  readonly content: string;
  readonly usage: ChatUsage;
  readonly model: string;
}

export interface LLMClient {
  readonly id: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}

export interface ZenClientOptions {
  readonly baseUrl?: string;
  readonly apiKey: string;
  readonly timeoutMs?: number;
  readonly retry?: Partial<RetryOptions>;
  readonly useJsonResponseFormat?: boolean;
}

const DEFAULT_BASE_URL = "https://opencode.ai/zen/v1";

/** Pull a human-readable message out of a provider error body. */
function formatProviderError(text: string): string {
  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string; type?: string };
      message?: string;
      type?: string;
    };
    const err = parsed.error ?? parsed;
    const label = [err.type, err.message].filter((s): s is string => typeof s === "string" && s.length > 0).join(": ");
    return label || text.slice(0, 400);
  } catch {
    return text.slice(0, 400);
  }
}

function authHint(status: number, detail: string): string {
  if (status === 401) return " — check OPENCODE_ZEN_API_KEY.";
  if (status === 402 || /insufficient (account )?funds/i.test(detail)) {
    return " — this Zen account has no funds/credits; add billing, or set OPENCODE_ZEN_BASE_URL to another OpenAI-compatible endpoint.";
  }
  if (status === 403) {
    if (/free tier/i.test(detail)) {
      return (
        " — the *-free Zen models are only served inside the OpenCode client, not to external API keys. " +
        "Point each role at an openai-compatible model your key can call via HARNESS_MODEL_<ROLE> " +
        "(or a global HARNESS_MODEL), then re-run."
      );
    }
    return " — access denied for this model/key.";
  }
  if (status === 404) return " — unknown model id; check the HARNESS_MODEL_* overrides.";
  return "";
}

interface OpenAIChatResponse {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; type?: string; code?: string };
}

export class ZenClient implements LLMClient {
  readonly id = "opencode-zen";
  readonly baseUrl: string;
  #apiKey: string;
  #timeoutMs: number;
  #retry: Partial<RetryOptions>;
  #useJsonResponseFormat: boolean;

  constructor(options: ZenClientOptions) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#apiKey = options.apiKey;
    this.#timeoutMs = options.timeoutMs ?? 180_000;
    this.#retry = options.retry ?? {};
    this.#useJsonResponseFormat = options.useJsonResponseFormat ?? false;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): ZenClient {
    const apiKey = env.OPENCODE_ZEN_API_KEY ?? env.OPENCODE_API_KEY ?? "";
    if (!apiKey) {
      throw new ModelCallError(
        "missing OPENCODE_ZEN_API_KEY (set it in the environment or a .env file); use --demo for the offline self-test",
        false,
      );
    }
    return new ZenClient({
      baseUrl: env.OPENCODE_ZEN_BASE_URL ?? DEFAULT_BASE_URL,
      apiKey,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return await withRetry(async () => await this.#call(request), {
      ...this.#retry,
      isRetryable: (error) => (error instanceof ModelCallError ? error.retryable : true),
    });
  }

  /** Cheap credential/route preflight: one tiny completion per model. */
  async ping(model: string): Promise<{ readonly ok: boolean; readonly model: string; readonly detail: string }> {
    try {
      const res = await this.chat({ model, messages: [{ role: "user", content: "ping" }], maxTokens: 8 });
      return { ok: true, model, detail: `ok (${res.usage.completionTokens} out tokens)` };
    } catch (error) {
      return { ok: false, model, detail: errorMessage(error) };
    }
  }

  async #call(request: ChatRequest): Promise<ChatResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      stream: false,
    };
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
    if (request.json && this.#useJsonResponseFormat) {
      body.response_format = { type: "json_object" };
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.#apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new ModelCallError(aborted ? `request timed out after ${this.#timeoutMs}ms` : `network error: ${message}`, true, {
        model: request.model,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      const detail = formatProviderError(text);
      throw new ModelCallError(`HTTP ${response.status} from Zen: ${detail}${authHint(response.status, detail)}`, retryable, {
        status: response.status,
        model: request.model,
      });
    }

    let parsed: OpenAIChatResponse;
    try {
      parsed = JSON.parse(text) as OpenAIChatResponse;
    } catch (error) {
      throw new ModelCallError(`malformed JSON response: ${(error as Error).message}`, true, {
        sample: text.slice(0, 300),
      });
    }

    if (parsed.error) {
      throw new ModelCallError(`provider error: ${parsed.error.message ?? "unknown"}`, true, {
        model: request.model,
      });
    }

    const content = parsed.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new ModelCallError("provider returned no message content", true, {
        model: request.model,
        finish: parsed.choices?.[0]?.finish_reason ?? null,
      });
    }

    return {
      content,
      model: parsed.model ?? request.model,
      usage: {
        promptTokens: parsed.usage?.prompt_tokens ?? 0,
        completionTokens: parsed.usage?.completion_tokens ?? 0,
      },
    };
  }
}

/**
 * Deterministic offline client. It replays a queue of scripted responses and
 * throws when exhausted, which is what the self-test relies on.
 */
export class MockLLMClient implements LLMClient {
  readonly id = "mock";
  #responses: string[];
  #calls: ChatRequest[] = [];

  constructor(responses: readonly string[] = []) {
    this.#responses = [...responses];
  }

  get calls(): readonly ChatRequest[] {
    return this.#calls;
  }

  push(response: string): void {
    this.#responses.push(response);
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.#calls.push(request);
    const next = this.#responses.shift();
    if (next === undefined) {
      throw new ModelCallError("MockLLMClient exhausted its scripted responses", false, { model: request.model });
    }
    return {
      content: next,
      model: request.model,
      usage: { promptTokens: 100, completionTokens: 50 },
    };
  }
}
