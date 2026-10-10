/**
 * Independent Reviewer (big-pickle) — critiques generated changes against the
 * original goal and the project's conventions. Read-only: it never mutates code.
 */

import type { FileDiff, ProjectProfile, Task } from "../core/types.ts";
import { BaseAgent, type ToolName } from "./base.ts";

export interface ReviewerInput {
  readonly goal: string;
  readonly profile: ProjectProfile;
  readonly task: Task;
  readonly diffs: readonly FileDiff[];
  readonly changedFiles: readonly string[];
  readonly context: string;
}

export interface ReviewReport {
  readonly approved: boolean;
  readonly summary: string;
  readonly findings: readonly {
    readonly severity: "info" | "minor" | "major" | "blocker";
    readonly file: string | null;
    readonly detail: string;
    readonly goalAlignment: string;
  }[];
}

interface RawReport {
  approved?: unknown;
  summary?: unknown;
  findings?: unknown;
}

const ALLOWED: readonly ToolName[] = ["read_file", "list_files", "search_files"];

export class Reviewer extends BaseAgent<ReviewReport> {
  readonly role = "reviewer" as const;

  protected allowedTools(): readonly ToolName[] {
    return ALLOWED;
  }

  protected systemPrompt(): string {
    return [
      "You are the INDEPENDENT REVIEWER. You are adversarial and precise. You do not edit code.",
      "Evaluate the change along two axes:",
      "  1) GOAL: does it actually satisfy the task and the original goal, including acceptance criteria?",
      "  2) STANDARDS: does it follow the language's conventions, the project's existing style, and correctness/safety norms?",
      "Read the changed files with read_file to verify claims rather than trusting summaries.",
      "Approve only when there are no blocker or major findings. Otherwise set approved=false and explain exactly what to fix.",
      'Final shape: {"approved": boolean, "summary": string, "findings": [{"severity": "info|minor|major|blocker", "file": string|null, "detail": string, "goalAlignment": string}]}',
    ].join("\n");
  }

  protected override finalize(value: unknown): ReviewReport {
    const raw = (value ?? {}) as RawReport;
    const allowedSev = new Set(["info", "minor", "major", "blocker"]);
    const findings = Array.isArray(raw.findings)
      ? (raw.findings as Record<string, unknown>[])
          .map((f) => ({
            severity: (allowedSev.has(String(f.severity)) ? String(f.severity) : "info") as ReviewReport["findings"][number]["severity"],
            file: typeof f.file === "string" ? f.file : null,
            detail: typeof f.detail === "string" ? f.detail : "",
            goalAlignment: typeof f.goalAlignment === "string" ? f.goalAlignment : "",
          }))
      : [];
    const approved = typeof raw.approved === "boolean" ? raw.approved : findings.every((f) => f.severity === "info");
    return { approved, summary: typeof raw.summary === "string" ? raw.summary : "", findings };
  }
}
