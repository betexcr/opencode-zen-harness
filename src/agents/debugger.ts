/**
 * Debugger (big-pickle) — ingests failed runtime/test console logs, maps the
 * errors back to source files, and writes minimal corrective patches.
 */

import type { ProjectProfile, Task, TestRun } from "../core/types.ts";
import { BaseAgent, type ToolName } from "./base.ts";

export interface DebuggerInput {
  readonly goal: string;
  readonly profile: ProjectProfile;
  readonly task: Task;
  readonly failedRun: TestRun;
  readonly context: string;
  readonly attempt: number;
}

export interface DebuggerReport {
  readonly diagnosis: string;
  readonly rootCauseFiles: readonly string[];
  readonly patchedFiles: readonly string[];
  readonly notes: string;
}

interface RawReport {
  diagnosis?: unknown;
  rootCauseFiles?: unknown;
  patchedFiles?: unknown;
  notes?: unknown;
}

const ALLOWED: readonly ToolName[] = ["read_file", "apply_patch", "write_file", "list_files", "search_files", "run_command"];

export class Debugger extends BaseAgent<DebuggerReport> {
  readonly role = "debugger" as const;

  protected allowedTools(): readonly ToolName[] {
    return ALLOWED;
  }

  protected systemPrompt(): string {
    return [
      "You are the DEBUGGER. A test/build command failed. Your job is root-cause analysis and a minimal fix.",
      "Method:",
      "1. Read the failing command's stderr/stdout carefully. Extract the exact error and stack frames.",
      "2. Locate the responsible source with search_files/read_file.",
      "3. apply_patch (or write_file) the smallest change that addresses the root cause, not the symptom.",
      "4. Do not weaken or delete tests to make them pass. Do not swallow errors.",
      'Final shape: {"diagnosis": string, "rootCauseFiles": string[], "patchedFiles": string[], "notes": string}',
    ].join("\n");
  }

  protected override finalize(value: unknown): DebuggerReport {
    const raw = (value ?? {}) as RawReport;
    const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
    return {
      diagnosis: typeof raw.diagnosis === "string" ? raw.diagnosis : "",
      rootCauseFiles: asArr(raw.rootCauseFiles),
      patchedFiles: asArr(raw.patchedFiles),
      notes: typeof raw.notes === "string" ? raw.notes : "",
    };
  }
}
