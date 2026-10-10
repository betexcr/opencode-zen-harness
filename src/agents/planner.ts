/**
 * Planner (big-pickle) — decomposes the raw goal into an ordered execution
 * plan. In existing mode it first reads the architecture; in new mode it
 * invents the directory layout and baseline configuration.
 */

import type { Phase, ProjectProfile, Task } from "../core/types.ts";
import { BaseAgent, type ToolName } from "./base.ts";

export interface PlannerInput {
  readonly goal: string;
  readonly mode: ProjectProfile["mode"];
  readonly profile: ProjectProfile;
  readonly phase: Phase;
  readonly existingFiles: readonly string[];
  readonly indexSummary: string | null;
  readonly priorPlan: string | null;
}

interface RawTask {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  files?: unknown;
  commands?: unknown;
  acceptance?: unknown;
  dependsOn?: unknown;
}

interface RawPlan {
  summary?: unknown;
  tasks?: unknown;
}

const ALLOWED: readonly ToolName[] = ["list_files", "read_file", "search_files"];

export class Planner extends BaseAgent<import("../core/types.ts").Plan> {
  readonly role = "planner" as const;

  protected allowedTools(): readonly ToolName[] {
    return ALLOWED;
  }

  protected systemPrompt(): string {
    return [
      "You are the PLANNER, the highest-reasoning node in an autonomous software-engineering harness.",
      "You convert a raw goal into a precise, dependency-ordered execution plan of atomic tasks.",
      "Rules:",
      "- Inspect the workspace with tools before writing the plan (list_files, read_file, search_files).",
      "- Each task must name the concrete files it will touch and the acceptance criteria that prove it done.",
      "- In new-project mode invent the full directory layout and baseline config files (package manifest, entrypoint, tests).",
      "- In existing-project mode plan minimal, surgical changes that respect the detected stack and conventions.",
      "- Order tasks so later tasks depend only on earlier ones. Use stable ids: task-1, task-2, ...",
      'Final shape: {"summary": string, "tasks": [{"id": string, "title": string, "description": string, "files": string[], "commands": string[], "acceptance": string[], "dependsOn": string[]}]}',
    ].join("\n");
  }

  protected override finalize(value: unknown): import("../core/types.ts").Plan {
    const raw = (value ?? {}) as RawPlan;
    const tasksRaw = Array.isArray(raw.tasks) ? (raw.tasks as RawTask[]) : [];
    const tasks: Task[] = tasksRaw.map((t, i) => ({
      id: typeof t.id === "string" && t.id.length > 0 ? t.id : `task-${i + 1}`,
      title: typeof t.title === "string" ? t.title : `Task ${i + 1}`,
      description: typeof t.description === "string" ? t.description : "",
      files: toStringArray(t.files),
      commands: toStringArray(t.commands),
      acceptance: toStringArray(t.acceptance),
      dependsOn: toStringArray(t.dependsOn),
      status: "pending",
      attempts: 0,
      lastError: null,
    }));
    const summary = typeof raw.summary === "string" ? raw.summary : "Execution plan";
    return { summary, tasks };
  }
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}
