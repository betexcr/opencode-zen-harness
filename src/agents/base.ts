/**
 * Base agent: a model-agnostic ReAct tool loop.
 *
 * Every agent speaks the same wire protocol — a single JSON object per turn —
 * which keeps the harness portable across providers that do and do not support
 * native function calling:
 *
 *   Tool call : {"thought": "...", "tool": "<name>", "args": { ... }}
 *   Final     : {"thought": "...", "final": <value>}
 */

import type { AgentRole, AgentRouting, GenerationConfig } from "../config/models.ts";
import { AGENT_GENERATION, AGENT_MODEL_ROUTING } from "../config/models.ts";
import { AgentError, errorMessage, HarnessError } from "../core/errors.ts";
import type { DiffAction } from "../core/types.ts";
import type { StateStore } from "../core/state.ts";
import type { ChatMessage, LLMClient } from "../llm/client.ts";
import { createUnifiedDiff } from "../tools/diff.ts";
import type { SystemToolbox } from "../tools/toolbox.ts";

export type ToolName =
  | "read_file"
  | "write_file"
  | "apply_patch"
  | "delete_file"
  | "list_files"
  | "search_files"
  | "run_command";

export interface ToolSpec {
  readonly name: ToolName;
  readonly summary: string;
  readonly args: string;
}

export const TOOL_SPECS: Readonly<Record<ToolName, ToolSpec>> = Object.freeze({
  read_file: { name: "read_file", summary: "Read a UTF-8 file's contents.", args: "{ path: string, startLine?: number, endLine?: number }" },
  write_file: { name: "write_file", summary: "Create or overwrite a file with full contents.", args: "{ path: string, content: string }" },
  apply_patch: { name: "apply_patch", summary: "Apply a unified diff to an existing file.", args: "{ path: string, diff: string }" },
  delete_file: { name: "delete_file", summary: "Delete a file inside the workspace.", args: "{ path: string }" },
  list_files: { name: "list_files", summary: "Recursively list files (ignore-aware).", args: "{ path?: string }" },
  search_files: { name: "search_files", summary: "Regex/literal content search across files.", args: "{ pattern: string, isRegex?: boolean }" },
  run_command: { name: "run_command", summary: "Run a shell command in the workspace root.", args: "{ command: string, cwd?: string }" },
});

export interface MutationRecord {
  readonly path: string;
  readonly action: DiffAction;
  readonly unifiedDiff: string;
  readonly taskId: string | null;
}

export interface AgentContext {
  readonly role: AgentRole;
  readonly model: string;
  readonly generation: GenerationConfig;
  readonly client: LLMClient;
  readonly toolbox: SystemToolbox;
  readonly store: StateStore;
  readonly maxSteps: number;
  readonly recordDiff: (mutation: MutationRecord) => void;
}

export interface Turn {
  readonly step: number;
  readonly thought: string;
  readonly tool: ToolName | null;
  readonly args: Record<string, unknown> | null;
  readonly observation: string | null;
}

export interface AgentOutcome<TFinal> {
  readonly role: AgentRole;
  readonly model: string;
  readonly final: TFinal;
  readonly turns: readonly Turn[];
  readonly steps: number;
}

interface ParsedToolAction {
  readonly kind: "tool";
  readonly thought: string;
  readonly tool: string;
  readonly args: Record<string, unknown>;
}
interface ParsedFinalAction {
  readonly kind: "final";
  readonly thought: string;
  readonly value: unknown;
}
type ParsedAction = ParsedToolAction | ParsedFinalAction;

const MAX_OBSERVATION_CHARS = 8_000;

export abstract class BaseAgent<TFinal> {
  abstract readonly role: AgentRole;
  readonly taskId: string | null;

  constructor(taskId: string | null = null) {
    this.taskId = taskId;
  }

  protected abstract systemPrompt(): string;
  protected abstract allowedTools(): readonly ToolName[];
  protected buildUserMessage(input: unknown): string {
    return typeof input === "string" ? input : JSON.stringify(input, null, 2);
  }
  /** Hook for normalising/validating the parsed final value. */
  protected finalize(value: unknown): TFinal {
    return value as TFinal;
  }

  makeContext(ctx: Omit<AgentContext, "role" | "model" | "generation"> & { routing: AgentRouting }): AgentContext {
    const { routing, ...rest } = ctx;
    return {
      ...rest,
      role: this.role,
      model: routing[this.role] ?? AGENT_MODEL_ROUTING[this.role],
      generation: AGENT_GENERATION[this.role],
    };
  }

  async invoke(input: unknown, ctx: AgentContext): Promise<AgentOutcome<TFinal>> {
    const model = ctx.model;
    const messages: ChatMessage[] = [
      { role: "system", content: this.systemPrompt() + this.protocolInstructions() },
      { role: "user", content: this.buildUserMessage(input) },
    ];
    const turns: Turn[] = [];
    let lastRaw = "";

    for (let step = 1; step <= ctx.maxSteps; step++) {
      this.#log(ctx, "debug", `agent step ${step}/${ctx.maxSteps}`);
      const response = await ctx.client.chat({
        model,
        messages,
        temperature: ctx.generation.temperature,
        maxTokens: ctx.generation.maxTokens,
      });
      lastRaw = response.content;
      ctx.store.bumpMetrics({
        agentCalls: 1,
        tokensIn: response.usage.promptTokens,
        tokensOut: response.usage.completionTokens,
      });

      const action = parseAction(response.content);
      if (!action) {
        turns.push({ step, thought: "", tool: null, args: null, observation: "unparseable response" });
        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content:
            "SYSTEM: Your last reply was not valid JSON. Reply with exactly ONE JSON object as specified. " +
            'For a tool: {"thought":"...","tool":"<name>","args":{...}}. To finish: {"thought":"...","final":<value>}.',
        });
        continue;
      }

      if (action.kind === "final") {
        turns.push({ step, thought: action.thought, tool: null, args: null, observation: null });
        return { role: this.role, model, final: this.finalize(action.value), turns, steps: step };
      }

      const allowed = this.allowedTools();
      if (!allowed.includes(action.tool as ToolName)) {
        const observation = `ERROR: tool '${action.tool}' is not permitted. Allowed: ${allowed.join(", ")}`;
        turns.push({ step, thought: action.thought, tool: action.tool as ToolName, args: action.args, observation });
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: `OBSERVATION:\n${observation}` });
        continue;
      }

      let observation: string;
      try {
        observation = await this.executeTool(action.tool as ToolName, action.args, ctx);
      } catch (error) {
        observation = `ERROR: ${errorMessage(error)}`;
      }
      turns.push({
        step,
        thought: action.thought,
        tool: action.tool as ToolName,
        args: action.args,
        observation: truncate(observation, MAX_OBSERVATION_CHARS),
      });
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content:
          `OBSERVATION:\n${truncate(observation, MAX_OBSERVATION_CHARS)}\n\n` +
          "Continue. Reply with the next single JSON object (another tool call or your final answer).",
      });
    }

    throw new AgentError(this.role, `exceeded maxSteps (${ctx.maxSteps}) without producing a final answer`, {
      lastRaw: truncate(lastRaw, 500),
    });
  }

  protected async executeTool(name: ToolName, args: Record<string, unknown>, ctx: AgentContext): Promise<string> {
    const tb = ctx.toolbox;
    switch (name) {
      case "read_file": {
        const path = requireString(args, "path");
        const content = await tb.readFile(path);
        const startLine = optionalNumber(args, "startLine");
        const endLine = optionalNumber(args, "endLine");
        const lines = content.split(/\r?\n/);
        const from = startLine ? Math.max(1, startLine) : 1;
        const to = endLine ? Math.min(lines.length, endLine) : lines.length;
        const slice = lines.slice(from - 1, to).map((line, idx) => `${from + idx}: ${line}`);
        return slice.join("\n") || "(empty file)";
      }
      case "write_file": {
        const path = requireString(args, "path");
        const content = requireString(args, "content");
        const existed = await tb.exists(path);
        const before = existed ? await tb.readFile(path) : "";
        const result = await tb.writeFile(path, content);
        const unifiedDiff = createUnifiedDiff(existed ? `a/${result.path}` : "/dev/null", `b/${result.path}`, before, content);
        ctx.recordDiff({ path: result.path, action: existed ? "update" : "create", unifiedDiff, taskId: this.taskId });
        return `${result.created ? "created" : "overwrote"} ${result.path} (${result.bytes} bytes)`;
      }
      case "apply_patch": {
        const path = requireString(args, "path");
        const diff = requireString(args, "diff");
        const result = await tb.applyPatch(path, diff);
        const unifiedDiff = createUnifiedDiff(`a/${result.path}`, `b/${result.path}`, result.before, result.after);
        ctx.recordDiff({ path: result.path, action: "update", unifiedDiff, taskId: this.taskId });
        return `patched ${result.path}`;
      }
      case "delete_file": {
        const path = requireString(args, "path");
        const before = (await tb.exists(path)) ? await tb.readFile(path) : "";
        const removed = await tb.deleteFile(path);
        const unifiedDiff = createUnifiedDiff(`a/${removed}`, "/dev/null", before, "");
        ctx.recordDiff({ path: removed, action: "delete", unifiedDiff, taskId: this.taskId });
        return `deleted ${removed}`;
      }
      case "list_files": {
        const path = typeof args.path === "string" ? args.path : ".";
        const files = await tb.listFiles(path, { maxFiles: 400 });
        return files.length > 0 ? files.join("\n") : "(no files)";
      }
      case "search_files": {
        const pattern = requireString(args, "pattern");
        const isRegex = typeof args.isRegex === "boolean" ? args.isRegex : true;
        const hits = await tb.search(pattern, { isRegex, maxResults: 80 });
        return hits.length > 0 ? hits.map((h) => `${h.path}:${h.line}: ${h.text}`).join("\n") : "(no matches)";
      }
      case "run_command": {
        const command = requireString(args, "command");
        const cwd = typeof args.cwd === "string" ? args.cwd : undefined;
        const result = await tb.runCommand(command, cwd ? { cwd } : {});
        return [
          `command: ${result.command}`,
          `exit: ${result.code ?? "null"}${result.timedOut ? " (TIMED OUT)" : ""}`,
          `stdout:\n${result.stdout.slice(0, 4_000) || "(empty)"}`,
          `stderr:\n${result.stderr.slice(0, 2_000) || "(empty)"}`,
        ].join("\n");
      }
      default:
        throw new HarnessError("UNKNOWN_TOOL", `no executor for tool '${name}'`);
    }
  }

  protected protocolInstructions(): string {
    const tools = this.allowedTools();
    const toolLines = tools.map((name) => {
      const spec = TOOL_SPECS[name];
      return `  - ${spec.name}: ${spec.summary} args ${spec.args}`;
    });
    const toolSection =
      tools.length > 0
        ? `\nAvailable tools:\n${toolLines.join("\n")}\n\nTo call a tool reply with: {"thought":"<why>","tool":"<name>","args":{...}}`
        : "\nYou have NO tools. Reply directly with your final answer.";
    return (
      "\n\n=== PROTOCOL ===\n" +
      "You are one node in a deterministic multi-agent pipeline. Reply with EXACTLY ONE JSON object and nothing else.\n" +
      toolSection +
      '\n\nWhen you are done, reply with: {"thought":"<why>","final":<your result as described by the task>}\n' +
      "Never wrap the JSON in markdown code fences. Never include prose outside the JSON."
    );
  }

  #log(ctx: AgentContext, level: "debug" | "info" | "warn" | "error", message: string): void {
    ctx.store.log(level, this.role, message);
  }
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new HarnessError("BAD_TOOL_ARGS", `expected string argument '${key}'`, { key, got: typeof value });
  }
  return value;
}

function optionalNumber(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" ? value : undefined;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n...[truncated ${text.length - max} chars]`;
}

/** Extract the first balanced JSON object from arbitrary model output. */
export function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  const direct = tryParse(trimmed);
  if (direct !== undefined) return direct;

  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fence && fence[1]) {
    const fenced = tryParse(fence[1].trim());
    if (fenced !== undefined) return fenced;
  }

  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return tryParse(raw.slice(start, i + 1)) ?? null;
      }
    }
  }
  return null;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function parseAction(raw: string): ParsedAction | null {
  const parsed = extractJsonObject(raw);
  if (parsed === null || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const thought = typeof obj.thought === "string" ? obj.thought : "";
  if ("final" in obj) {
    return { kind: "final", thought, value: obj.final };
  }
  if (typeof obj.tool === "string") {
    const args = obj.args && typeof obj.args === "object" ? (obj.args as Record<string, unknown>) : {};
    return { kind: "tool", thought, tool: obj.tool, args };
  }
  // Tolerate {"action":"final","value":...} shapes.
  if (obj.action === "final") {
    return { kind: "final", thought, value: obj.value };
  }
  return null;
}
