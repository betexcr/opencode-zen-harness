/**
 * Test Engineer (nemotron-3-ultra-free) — dependable structured output.
 * Synthesizes unit assertions, integration specs, and environment mocks that
 * target the task's acceptance criteria.
 */

import type { ProjectProfile, Task } from "../core/types.ts";
import { BaseAgent, type ToolName } from "./base.ts";

export interface TestEngineerInput {
  readonly goal: string;
  readonly profile: ProjectProfile;
  readonly task: Task;
  readonly changedFiles: readonly string[];
  readonly context: string;
}

export interface TestReport {
  readonly testFiles: readonly { readonly path: string; readonly summary: string }[];
  readonly commands: readonly string[];
  readonly notes: string;
}

interface RawReport {
  testFiles?: unknown;
  commands?: unknown;
  notes?: unknown;
}

const ALLOWED: readonly ToolName[] = ["read_file", "write_file", "apply_patch", "list_files"];

export class TestEngineer extends BaseAgent<TestReport> {
  readonly role = "test-engineer" as const;

  protected allowedTools(): readonly ToolName[] {
    return ALLOWED;
  }

  protected systemPrompt(): string {
    return [
      "You are the TEST ENGINEER. You produce deterministic, comprehensive automated tests.",
      "Given a task and the files it changed, write tests that prove each acceptance criterion.",
      "Rules:",
      "- Use the test framework implied by the detected stack (pytest, jest/vitest, cargo test, go test, junit, rspec).",
      "- Cover the happy path, edge cases, and error paths. Include mocks/fixtures for external services.",
      "- Tests must be runnable non-interactively and must not depend on network access.",
      "- Read the target source files first so assertions match real signatures.",
      'Final shape: {"testFiles": [{"path": string, "summary": string}], "commands": string[], "notes": string}',
    ].join("\n");
  }

  protected override finalize(value: unknown): TestReport {
    const raw = (value ?? {}) as RawReport;
    const testFiles = Array.isArray(raw.testFiles)
      ? (raw.testFiles as { path?: unknown; summary?: unknown }[])
          .filter((f) => typeof f.path === "string")
          .map((f) => ({ path: f.path as string, summary: typeof f.summary === "string" ? f.summary : "" }))
      : [];
    const commands = Array.isArray(raw.commands)
      ? raw.commands.filter((c): c is string => typeof c === "string")
      : [];
    return { testFiles, commands, notes: typeof raw.notes === "string" ? raw.notes : "" };
  }
}
