/**
 * Release / Verification Agent (mimo-v2.6-flash-free) — elite-latency shell
 * orchestration: linters, formatters, compilation, the test suite, and final
 * git staging/commit. It executes commands and reports a machine-readable
 * per-stage result the orchestrator records into HarnessState.
 */

import type { ProjectProfile, TestStage } from "../core/types.ts";
import { BaseAgent, type ToolName } from "./base.ts";

export interface ReleaseInput {
  readonly goal: string;
  readonly profile: ProjectProfile;
  readonly stages: readonly { readonly name: string; readonly command: string | null }[];
  readonly commitMessage: string | null;
  readonly git: { readonly isRepo: boolean; readonly branch: string | null };
}

export interface ReleaseStageResult {
  readonly name: string;
  readonly stage: TestStage;
  readonly command: string;
  readonly ok: boolean;
  readonly exitCode: number | null;
  readonly output: string;
}

export interface ReleaseReport {
  readonly stages: readonly ReleaseStageResult[];
  readonly committed: boolean;
  readonly commitSha: string | null;
  readonly notes: string;
}

interface RawReport {
  stages?: unknown;
  committed?: unknown;
  commitSha?: unknown;
  notes?: unknown;
}

const VALID_STAGES = new Set<TestStage>(["build", "unit", "integration", "lint", "format", "typecheck", "custom"]);

function coerceStage(name: string): TestStage {
  const lower = name.toLowerCase();
  if (VALID_STAGES.has(lower as TestStage)) return lower as TestStage;
  if (lower.includes("lint")) return "lint";
  if (lower.includes("format")) return "format";
  if (lower.includes("build") || lower.includes("compile")) return "build";
  if (lower.includes("type")) return "typecheck";
  if (lower.includes("unit")) return "unit";
  if (lower.includes("integration") || lower.includes("e2e")) return "integration";
  return "custom";
}

const ALLOWED: readonly ToolName[] = ["run_command", "list_files", "read_file"];

export class ReleaseAgent extends BaseAgent<ReleaseReport> {
  readonly role = "release" as const;

  protected allowedTools(): readonly ToolName[] {
    return ALLOWED;
  }

  protected systemPrompt(): string {
    return [
      "You are the RELEASE / VERIFICATION agent. You are the last gate before work is considered shippable.",
      "You coordinate shell commands through run_command: installs, linters, formatters, compilation, and the test suite.",
      "Procedure:",
      "1. Run each provided stage in order with its command. Capture the exit code from the observation ('exit:').",
      "2. A stage is ok only if its exit code is 0. Do not mark a failing stage as ok.",
      "3. If a formatter rewrites files, that is fine; re-run the check stage if one exists.",
      "4. When every stage passes and git is available, stage and commit with: git add -A && git commit -m \"<message>\".",
      "   Capture the resulting commit sha with: git rev-parse --short HEAD.",
      "5. Never use --no-verify, never force-push, never amend.",
      'Final shape: {"stages": [{"name": string, "stage": "build|unit|integration|lint|format|typecheck|custom", "command": string, "ok": boolean, "exitCode": number|null, "output": string}], "committed": boolean, "commitSha": string|null, "notes": string}',
    ].join("\n");
  }

  protected override finalize(value: unknown): ReleaseReport {
    const raw = (value ?? {}) as RawReport;
    const stages = Array.isArray(raw.stages)
      ? (raw.stages as Record<string, unknown>[]).map((s) => {
          const name = typeof s.name === "string" ? s.name : "stage";
          return {
            name,
            stage: coerceStage(name),
            command: typeof s.command === "string" ? s.command : "",
            ok: typeof s.ok === "boolean" ? s.ok : s.exitCode === 0,
            exitCode: typeof s.exitCode === "number" ? s.exitCode : null,
            output: typeof s.output === "string" ? s.output : "",
          } satisfies ReleaseStageResult;
        })
      : [];
    return {
      stages,
      committed: typeof raw.committed === "boolean" ? raw.committed : false,
      commitSha: typeof raw.commitSha === "string" ? raw.commitSha : null,
      notes: typeof raw.notes === "string" ? raw.notes : "",
    };
  }
}
