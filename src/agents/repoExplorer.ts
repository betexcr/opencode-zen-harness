/**
 * Repo Explorer (longcat-2.5-preview-free) — fast, large-context retrieval.
 * Reads targeted files and builds an in-memory structural index used by the
 * Planner, Builder and Reviewer as grounded context.
 */

import type { RepoIndex, RepoIndexEntry } from "../core/types.ts";
import { BaseAgent, type ToolName } from "./base.ts";

export interface ExplorerInput {
  readonly goal: string;
  readonly candidateFiles: readonly string[];
  readonly mode: string;
  readonly frameworkHint: string | null;
}

interface RawEntry {
  path?: unknown;
  role?: unknown;
  summary?: unknown;
  symbols?: unknown;
}

interface RawIndex {
  framework?: unknown;
  entries?: unknown;
  relevantToGoal?: unknown;
}

const ALLOWED: readonly ToolName[] = ["list_files", "read_file", "search_files", "run_command"];

export class RepoExplorer extends BaseAgent<RepoIndex> {
  readonly role = "repo-explorer" as const;

  protected allowedTools(): readonly ToolName[] {
    return ALLOWED;
  }

  protected systemPrompt(): string {
    return [
      "You are the REPO EXPLORER. You map an unfamiliar or existing codebase into a compact structural index.",
      "Work fast and broadly: list_files to see the tree, search_files to locate entrypoints and framework markers,",
      "read_file to confirm the role of only the most important files (entrypoints, config, core modules, tests).",
      "For each file you judge significant, record its role, a one-line summary, and the key symbols it exports/defines.",
      "Identify which indexed files are directly relevant to the current goal.",
      'Final shape: {"framework": string|null, "entries": [{"path": string, "role": string, "summary": string, "symbols": string[]}], "relevantToGoal": string[]}',
      "Do not exceed a reasonable number of read_file calls; prefer breadth then depth.",
    ].join("\n");
  }

  protected override finalize(value: unknown): RepoIndex {
    const raw = (value ?? {}) as RawIndex;
    const entriesRaw = Array.isArray(raw.entries) ? (raw.entries as RawEntry[]) : [];
    const entries: RepoIndexEntry[] = entriesRaw
      .filter((e) => typeof e.path === "string")
      .map((e) => ({
        path: e.path as string,
        role: typeof e.role === "string" ? e.role : "module",
        summary: typeof e.summary === "string" ? e.summary : "",
        symbols: Array.isArray(e.symbols) ? e.symbols.filter((s): s is string => typeof s === "string") : [],
        bytes: 0,
      }));
    const relevant = Array.isArray(raw.relevantToGoal)
      ? raw.relevantToGoal.filter((s): s is string => typeof s === "string")
      : [];
    return {
      framework: typeof raw.framework === "string" ? raw.framework : null,
      entries,
      relevantToGoal: relevant,
    };
  }
}
