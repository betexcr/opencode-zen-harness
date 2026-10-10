/**
 * Transport selection.
 *
 *   zen (default)  -> direct OpenCode Zen HTTP API (needs OPENCODE_ZEN_API_KEY
 *                     and a funded account or a non-gated model).
 *   opencode-cli   -> route through the local `opencode run` CLI, which uses the
 *                     OpenCode client's own auth so the free-tier models work.
 *
 * Select with HARNESS_TRANSPORT=opencode-cli.
 */

import { ModelCallError } from "../core/errors.ts";
import type { LLMClient } from "./client.ts";
import { ZenClient } from "./client.ts";
import { OpenCodeCliClient } from "./opencodeCliClient.ts";

export type Transport = "zen" | "opencode-cli";

export function resolveTransport(env: NodeJS.ProcessEnv = process.env): Transport {
  const value = (env.HARNESS_TRANSPORT ?? "zen").trim().toLowerCase();
  if (value === "opencode-cli" || value === "cli" || value === "opencode") return "opencode-cli";
  return "zen";
}

export function createLLMClient(env: NodeJS.ProcessEnv = process.env): LLMClient {
  return resolveTransport(env) === "opencode-cli" ? OpenCodeCliClient.fromEnv(env) : ZenClient.fromEnv(env);
}

/**
 * Generic credential/route preflight over any transport. Returns the outcome
 * for a single model (never throws).
 */
export async function pingModel(
  client: LLMClient,
  model: string,
): Promise<{ readonly ok: boolean; readonly model: string; readonly detail: string }> {
  try {
    const res = await client.chat({ model, messages: [{ role: "user", content: "ping" }], maxTokens: 8 });
    return { ok: true, model, detail: `ok (${res.usage.completionTokens} out tokens)` };
  } catch (error) {
    const detail = error instanceof ModelCallError ? error.message : error instanceof Error ? error.message : String(error);
    return { ok: false, model, detail };
  }
}
