/**
 * OpenCode CLI transport.
 *
 * The Zen free tier is gated to the OpenCode client ("can only be used from
 * within OpenCode"), so an external API-key client gets HTTP 403. This adapter
 * routes model calls through the `opencode run` CLI instead, which the gateway
 * treats as a first-party client — no API key required, and the `-free` models
 * work as-is.
 *
 * Each call spawns `opencode run -m <provider>/<model> --format json`, feeds the
 * flattened conversation on stdin, and parses the newline-delimited JSON event
 * stream back into a {@link ChatResponse}. The agent wire protocol (one JSON
 * object per turn) is carried inside the prompt, so it works unchanged.
 */

import { spawn } from "node:child_process";
import { ModelCallError } from "../core/errors.ts";
import type { ChatMessage, ChatRequest, ChatResponse, LLMClient } from "./client.ts";

export interface OpenCodeCliOptions {
  readonly binary?: string;
  readonly provider?: string;
  readonly timeoutMs?: number;
  readonly pure?: boolean;
  readonly cwd?: string;
}

interface ProcessResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly spawnError: Error | null;
}

const DEFAULT_BINARY = "opencode";
const DEFAULT_PROVIDER = "opencode";
const DEFAULT_TIMEOUT_MS = 180_000;

export class OpenCodeCliClient implements LLMClient {
  readonly id = "opencode-cli";
  #binary: string;
  #provider: string;
  #timeoutMs: number;
  #pure: boolean;
  #cwd: string | undefined;

  constructor(options: OpenCodeCliOptions = {}) {
    this.#binary = options.binary ?? DEFAULT_BINARY;
    this.#provider = options.provider ?? DEFAULT_PROVIDER;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#pure = options.pure ?? false;
    this.#cwd = options.cwd;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): OpenCodeCliClient {
    return new OpenCodeCliClient({
      binary: env.HARNESS_OPENCODE_BIN ?? undefined,
      provider: env.HARNESS_OPENCODE_PROVIDER ?? undefined,
      timeoutMs: env.HARNESS_OPENCODE_TIMEOUT_MS ? Number(env.HARNESS_OPENCODE_TIMEOUT_MS) : undefined,
      pure: env.HARNESS_OPENCODE_PURE === "1" || env.HARNESS_OPENCODE_PURE === "true",
      cwd: env.HARNESS_WORKSPACE ?? undefined,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const modelRef = request.model.includes("/") ? request.model : `${this.#provider}/${request.model}`;
    const prompt = flatten(request.messages);
    const args = ["run", "-m", modelRef, "--format", "json"];
    if (this.#pure) args.push("--pure");
    if (this.#cwd) args.push("--dir", this.#cwd);

    const result = await runProcess(this.#binary, args, prompt, this.#timeoutMs, this.#cwd);

    if (result.spawnError) {
      throw new ModelCallError(
        `failed to launch '${this.#binary}' (${result.spawnError.message}). Is the OpenCode CLI on PATH? Use --ping to check.`,
        false,
        { model: request.model },
      );
    }
    if (result.timedOut) {
      throw new ModelCallError(`opencode run timed out after ${this.#timeoutMs}ms`, true, { model: request.model });
    }

    const events = parseEvents(result.stdout);
    if (!events.text) {
      if (events.error) {
        throw new ModelCallError(`opencode run reported: ${events.error}`, true, { model: request.model });
      }
      const detail = (result.stderr || result.stdout).trim().slice(0, 400);
      throw new ModelCallError(
        `opencode run produced no assistant text (exit ${result.code ?? "null"}): ${detail || "(empty output)"}`,
        true,
        { model: request.model },
      );
    }

    return {
      content: events.text,
      model: request.model,
      usage: { promptTokens: events.promptTokens, completionTokens: events.completionTokens },
    };
  }
}

/**
 * Collapse the harness's role-tagged message list into a single prompt for the
 * stateless `opencode run` invocation, preserving the system instructions that
 * carry the one-JSON-object-per-turn protocol.
 */
function flatten(messages: readonly ChatMessage[]): string {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages.filter((m) => m.role !== "system");
  const conversation = turns
    .map((m) => `### ${m.role.toUpperCase()}\n${m.content}`)
    .join("\n\n");
  return [
    "You are being driven as a stateless completion backend by an autonomous harness.",
    "Follow the SYSTEM INSTRUCTIONS exactly. Do NOT use any tools, do NOT write files, and do NOT add commentary.",
    "Produce ONLY the next ASSISTANT message.",
    "",
    "=== SYSTEM INSTRUCTIONS ===",
    system,
    "",
    "=== CONVERSATION (oldest first) ===",
    conversation,
    "",
    "=== YOUR TURN (emit the next ASSISTANT message only) ===",
  ].join("\n");
}

interface ParsedEvents {
  readonly text: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly error: string | null;
}

export function parseEvents(stdout: string): ParsedEvents {
  const texts: string[] = [];
  let promptTokens = 0;
  let completionTokens = 0;
  let error: string | null = null;

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    const part = (event.part ?? {}) as Record<string, unknown>;

    if (event.type === "text" && typeof part.text === "string") {
      texts.push(part.text);
    } else if (event.type === "step_finish") {
      const tokens = (part.tokens ?? {}) as { input?: number; output?: number };
      promptTokens += typeof tokens.input === "number" ? tokens.input : 0;
      completionTokens += typeof tokens.output === "number" ? tokens.output : 0;
    } else if (event.type === "error" || part.type === "error") {
      const detail = extractErrorMessage(event, part);
      if (detail) error = detail;
    }
  }

  return { text: texts.join("").trim(), promptTokens, completionTokens, error };
}

/** Pull a non-empty message out of assorted error-event shapes; ignore empties. */
function extractErrorMessage(event: Record<string, unknown>, part: Record<string, unknown>): string | null {
  for (const candidate of [part.error, event.error, part.message, event.message]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (candidate && typeof candidate === "object") {
      const message = (candidate as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
  }
  const name = (part.name ?? event.name) as unknown;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function runProcess(
  binary: string,
  args: readonly string[],
  input: string,
  timeoutMs: number,
  cwd: string | undefined,
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const child = spawn(binary, [...args], {
      cwd,
      windowsHide: true,
      env: { ...process.env, OPENCODE_ENABLE_EXA: process.env.OPENCODE_ENABLE_EXA ?? "1" },
    });

    const finish = (result: ProcessResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      finish({ code: null, stdout, stderr, timedOut: true, spawnError: null });
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => finish({ code: null, stdout, stderr, timedOut, spawnError: error }));
    child.on("close", (code) => finish({ code, stdout, stderr, timedOut, spawnError: null }));

    child.stdin?.on("error", () => {
      /* ignore EPIPE if the process exits early */
    });
    child.stdin?.end(input, "utf8");
  });
}
