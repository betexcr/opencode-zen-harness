/**
 * Builder (step-5-preview-free) — generates raw source, appends components, and
 * applies diffs. This is the only agent (besides the debugger) that mutates
 * source files, and every mutation is recorded into HarnessState as a diff.
 */

import type { ProjectProfile, Task } from "../core/types.ts";
import { BaseAgent, type ToolName } from "./base.ts";

export interface BuilderInput {
  readonly goal: string;
  readonly mode: ProjectProfile["mode"];
  readonly profile: ProjectProfile;
  readonly task: Task;
  readonly context: string;
  readonly priorFeedback: string | null;
}

export interface BuilderReport {
  readonly files: readonly { readonly path: string; readonly summary: string }[];
  readonly notes: string;
}

interface RawReport {
  files?: unknown;
  notes?: unknown;
}

const ALLOWED: readonly ToolName[] = ["read_file", "write_file", "apply_patch", "delete_file", "list_files"];

export class Builder extends BaseAgent<BuilderReport> {
  readonly role = "builder" as const;

  protected allowedTools(): readonly ToolName[] {
    return ALLOWED;
  }

  protected systemPrompt(): string {
    return [
      "You are the BUILDER. You write production-quality source code that satisfies exactly one task.",
      "Rules:",
      "- Prefer write_file for new files; use apply_patch for surgical edits to existing files.",
      "- Read files before editing them. Match the existing language, style, and module conventions.",
      "- Never leave TODOs or placeholder stubs. Every function you emit must be complete.",
      "- Keep changes minimal and scoped to the task's files and acceptance criteria.",
      "- If a previous attempt failed feedback is provided, fix the specific failure.",
      'Final shape: {"files": [{"path": string, "summary": string}], "notes": string}',
    ].join("\n");
  }

  protected override finalize(value: unknown): BuilderReport {
    const raw = (value ?? {}) as RawReport;
    const files = Array.isArray(raw.files)
      ? (raw.files as { path?: unknown; summary?: unknown }[])
          .filter((f) => typeof f.path === "string")
          .map((f) => ({ path: f.path as string, summary: typeof f.summary === "string" ? f.summary : "" }))
      : [];
    return { files, notes: typeof raw.notes === "string" ? raw.notes : "" };
  }
}
