/**
 * Central registry of OpenCode Zen model IDs and the explicit role -> model
 * routing table that every agent payload is dispatched through.
 *
 * The routing is intentional: each model is assigned to the roles that best
 * match its architectural strengths (reasoning depth, context window,
 * throughput, latency, and structural reliability of output).
 */

export const ZEN_MODEL = {
  /** High intelligence, 200k context reasoning tier. */
  BIG_PICKLE: "big-pickle",
  /** Balanced high intelligence, high throughput tier. */
  STEP_5_PREVIEW_FREE: "step-5-preview-free",
  /** 128k high context, low latency tier. */
  LONGCAT_2_5_PREVIEW_FREE: "longcat-2.5-preview-free",
  /** Dependable structural output tier. */
  NEMOTRON_3_ULTRA_FREE: "nemotron-3-ultra-free",
  /** Elite latency, 210+ tokens/sec flash tier. */
  MIMO_V2_6_FLASH_FREE: "mimo-v2.6-flash-free",
} as const;

export type ZenModelId = (typeof ZEN_MODEL)[keyof typeof ZEN_MODEL];

export const AGENT_ROLES = [
  "orchestrator",
  "planner",
  "repo-explorer",
  "builder",
  "test-engineer",
  "debugger",
  "reviewer",
  "security-auditor",
  "release",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export interface ModelProfile {
  readonly id: ZenModelId;
  readonly tier: string;
  readonly strengths: string;
  readonly reasoningEffort: "low" | "medium" | "high";
  readonly contextTokens: number;
}

export const MODEL_PROFILES: Readonly<Record<ZenModelId, ModelProfile>> = Object.freeze({
  [ZEN_MODEL.BIG_PICKLE]: {
    id: ZEN_MODEL.BIG_PICKLE,
    tier: "reasoning-200k",
    strengths: "deep multi-step reasoning, large-context synthesis, critique, root-cause analysis",
    reasoningEffort: "high",
    contextTokens: 200_000,
  },
  [ZEN_MODEL.STEP_5_PREVIEW_FREE]: {
    id: ZEN_MODEL.STEP_5_PREVIEW_FREE,
    tier: "balanced-throughput",
    strengths: "high-throughput orchestration, code generation, routing decisions",
    reasoningEffort: "medium",
    contextTokens: 128_000,
  },
  [ZEN_MODEL.LONGCAT_2_5_PREVIEW_FREE]: {
    id: ZEN_MODEL.LONGCAT_2_5_PREVIEW_FREE,
    tier: "context-128k-lowlatency",
    strengths: "fast large-context retrieval, file reading, structural indexing",
    reasoningEffort: "low",
    contextTokens: 128_000,
  },
  [ZEN_MODEL.NEMOTRON_3_ULTRA_FREE]: {
    id: ZEN_MODEL.NEMOTRON_3_ULTRA_FREE,
    tier: "structural-dependable",
    strengths: "reliable structured output, test synthesis, deterministic schemas",
    reasoningEffort: "medium",
    contextTokens: 128_000,
  },
  [ZEN_MODEL.MIMO_V2_6_FLASH_FREE]: {
    id: ZEN_MODEL.MIMO_V2_6_FLASH_FREE,
    tier: "flash-210tps",
    strengths: "very low latency shell orchestration, formatting, verification steps",
    reasoningEffort: "low",
    contextTokens: 128_000,
  },
});

/** Model id per role. Values are strings so overrides can point at any model. */
export type AgentRouting = Record<AgentRole, string>;

/** The default role -> model routing, exactly as specified by the topology. */
export const AGENT_MODEL_ROUTING: Readonly<AgentRouting> = Object.freeze({
  orchestrator: ZEN_MODEL.STEP_5_PREVIEW_FREE,
  planner: ZEN_MODEL.BIG_PICKLE,
  "repo-explorer": ZEN_MODEL.LONGCAT_2_5_PREVIEW_FREE,
  builder: ZEN_MODEL.STEP_5_PREVIEW_FREE,
  "test-engineer": ZEN_MODEL.NEMOTRON_3_ULTRA_FREE,
  debugger: ZEN_MODEL.BIG_PICKLE,
  reviewer: ZEN_MODEL.BIG_PICKLE,
  "security-auditor": ZEN_MODEL.BIG_PICKLE,
  release: ZEN_MODEL.MIMO_V2_6_FLASH_FREE,
});

/**
 * Resolve the effective routing, honouring per-role environment overrides.
 *
 *   HARNESS_MODEL_PLANNER=glm-5.1
 *   HARNESS_MODEL_BUILDER=minimax-m2.7
 *   HARNESS_MODEL=glm-5.1            # global fallback for any unset role
 *
 * The defaults target the `-free` tier, which the Zen gateway only serves to
 * the OpenCode client itself. External API-key deployments should override to
 * a paid, `openai-compatible` Zen model (e.g. glm-5.1, kimi-k2.6, minimax-m2.7,
 * qwen3.7-plus) or any other OpenAI-compatible endpoint.
 */
export function resolveAgentRouting(env: NodeJS.ProcessEnv = process.env): AgentRouting {
  const global = env.HARNESS_MODEL?.trim();
  const routing: AgentRouting = { ...AGENT_MODEL_ROUTING };
  for (const role of AGENT_ROLES) {
    const key = `HARNESS_MODEL_${role.toUpperCase().replace(/-/g, "_")}`;
    const value = env[key]?.trim() || global;
    if (value) routing[role] = value;
  }
  return routing;
}

export interface GenerationConfig {
  readonly temperature: number;
  readonly maxTokens: number;
}

export const AGENT_GENERATION: Readonly<Record<AgentRole, GenerationConfig>> = Object.freeze({
  orchestrator: { temperature: 0.1, maxTokens: 2_048 },
  planner: { temperature: 0.2, maxTokens: 8_192 },
  "repo-explorer": { temperature: 0.0, maxTokens: 4_096 },
  builder: { temperature: 0.05, maxTokens: 12_288 },
  "test-engineer": { temperature: 0.1, maxTokens: 8_192 },
  debugger: { temperature: 0.15, maxTokens: 8_192 },
  reviewer: { temperature: 0.2, maxTokens: 4_096 },
  "security-auditor": { temperature: 0.1, maxTokens: 4_096 },
  release: { temperature: 0.0, maxTokens: 2_048 },
});
