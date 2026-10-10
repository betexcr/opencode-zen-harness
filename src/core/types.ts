/**
 * Shared domain types for the harness. These are intentionally data-only so
 * that `HarnessState` can be made deeply immutable and safely shared across
 * every agent boundary.
 */

export type ProjectMode = "new" | "existing";

export type SupportedLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "rust"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "csharp"
  | "cpp"
  | "unknown";

export interface CommandPlan {
  readonly install: string | null;
  readonly build: string | null;
  readonly test: string | null;
  readonly lint: string | null;
  readonly format: string | null;
  readonly run: string | null;
}

export interface ProjectProfile {
  readonly mode: ProjectMode;
  readonly language: SupportedLanguage;
  readonly packageManager: string | null;
  /** Signature files used to reach the detection verdict, relative to root. */
  readonly signatureFiles: readonly string[];
  readonly commands: CommandPlan;
  readonly isGitRepo: boolean;
  /** Human-readable notes describing how detection branched. */
  readonly notes: readonly string[];
}

export interface GitInfo {
  readonly isRepo: boolean;
  readonly branch: string | null;
  readonly dirtyBefore: boolean;
  readonly scratchBranch: string | null;
  readonly createdScratch: boolean;
  readonly baseCommit: string | null;
}

export type TaskStatus = "pending" | "in-progress" | "done" | "failed" | "blocked";

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly files: readonly string[];
  readonly commands: readonly string[];
  readonly acceptance: readonly string[];
  readonly dependsOn: readonly string[];
  readonly status: TaskStatus;
  readonly attempts: number;
  readonly lastError: string | null;
}

export interface Plan {
  readonly summary: string;
  readonly tasks: readonly Task[];
}

export interface RepoIndexEntry {
  readonly path: string;
  readonly role: string;
  readonly summary: string;
  readonly symbols: readonly string[];
  readonly bytes: number;
}

export interface RepoIndex {
  readonly entries: readonly RepoIndexEntry[];
  readonly relevantToGoal: readonly string[];
  readonly framework: string | null;
}

export type DiffAction = "create" | "update" | "delete";

export interface FileDiff {
  readonly path: string;
  readonly action: DiffAction;
  readonly unifiedDiff: string;
  readonly taskId: string | null;
  readonly appliedAt: string;
}

export type TestStage = "build" | "unit" | "integration" | "lint" | "format" | "typecheck" | "custom";

export interface TestRun {
  readonly stage: TestStage;
  readonly command: string;
  readonly ok: boolean;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly taskId: string | null;
  readonly ranAt: string;
}

export interface ReviewFinding {
  readonly severity: "info" | "minor" | "major" | "blocker";
  readonly file: string | null;
  readonly detail: string;
  readonly goalAlignment: string;
}

export interface SecurityFinding {
  readonly severity: "info" | "low" | "medium" | "high" | "critical";
  readonly category: string;
  readonly file: string | null;
  readonly detail: string;
  readonly recommendation: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  readonly ts: string;
  readonly level: LogLevel;
  readonly source: string;
  readonly message: string;
  readonly data: Readonly<Record<string, unknown>> | null;
}

export type Phase =
  | "init"
  | "discovery"
  | "planning"
  | "exploring"
  | "building"
  | "testing"
  | "debugging"
  | "reviewing"
  | "security"
  | "releasing"
  | "done"
  | "failed";

export interface Metrics {
  readonly agentCalls: number;
  readonly retries: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly commandsRun: number;
  readonly filesWritten: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly startedAt: string;
}

export interface HistoryEntry {
  readonly ts: string;
  readonly phase: Phase;
  readonly event: string;
  readonly note: string;
}

export type RunStatus = "idle" | "running" | "succeeded" | "failed";
