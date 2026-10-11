/**
 * HarnessState — the single, centralized, immutable state object shared by
 * every agent in the topology. Mutations are expressed as pure transitions
 * applied by {@link StateStore}; the store hands out frozen snapshots and
 * refuses to expose a mutable reference, which makes concurrent agent reads
 * safe without locks.
 */

import { randomUUID } from "node:crypto";
import type {
  FileDiff,
  GitInfo,
  HistoryEntry,
  LogEntry,
  LogLevel,
  Metrics,
  Phase,
  Plan,
  ProjectProfile,
  RepoIndex,
  ReviewFinding,
  RunStatus,
  SecurityFinding,
  Task,
  TaskStatus,
  TestRun,
} from "./types.ts";

export interface HarnessState {
  readonly runId: string;
  readonly goal: string;
  readonly workspaceRoot: string;
  readonly mode: "new" | "existing";
  readonly phase: Phase;
  readonly status: RunStatus;
  readonly profile: ProjectProfile;
  readonly git: GitInfo;
  readonly plan: Plan | null;
  readonly tasks: readonly Task[];
  readonly index: RepoIndex | null;
  readonly diffs: readonly FileDiff[];
  readonly logs: readonly LogEntry[];
  readonly testRuns: readonly TestRun[];
  readonly reviews: readonly ReviewFinding[];
  readonly security: readonly SecurityFinding[];
  readonly metrics: Metrics;
  readonly memory: Readonly<Record<string, string>>;
  readonly history: readonly HistoryEntry[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== "object") return value;
  const obj = value as unknown as object;
  if (seen.has(obj) || Object.isFrozen(obj)) return value;
  seen.add(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    deepFreeze((obj as Record<string, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface InitialStateInput {
  readonly goal: string;
  readonly workspaceRoot: string;
  readonly profile: ProjectProfile;
  readonly git: GitInfo;
}

export function createInitialState(input: InitialStateInput): HarnessState {
  const ts = nowIso();
  const state: HarnessState = {
    runId: randomUUID(),
    goal: input.goal,
    workspaceRoot: input.workspaceRoot,
    mode: input.profile.mode,
    phase: "init",
    status: "idle",
    profile: input.profile,
    git: input.git,
    plan: null,
    tasks: [],
    index: null,
    diffs: [],
    logs: [],
    testRuns: [],
    reviews: [],
    security: [],
    metrics: {
      agentCalls: 0,
      retries: 0,
      tokensIn: 0,
      tokensOut: 0,
      commandsRun: 0,
      filesWritten: 0,
      testsPassed: 0,
      testsFailed: 0,
      startedAt: ts,
    },
    memory: {},
    history: [],
    createdAt: ts,
    updatedAt: ts,
  };
  return deepFreeze(state);
}

/** Patch shape: any subset of mutable fields, or a function producing it. */
export type StatePatch =
  | Partial<Omit<HarnessState, "runId" | "createdAt">>
  | ((current: HarnessState) => Partial<Omit<HarnessState, "runId" | "createdAt">>);

export interface TransactOptions {
  readonly phase?: Phase;
  readonly event?: string;
  readonly note?: string;
}

export interface StateStoreOptions {
  /**
   * Invoked with the new frozen snapshot after every transition. Used to drive
   * durable checkpointing; must not throw (errors are swallowed so a failed
   * save never breaks a run).
   */
  readonly onTransition?: (state: HarnessState) => void;
}

export class StateStore {
  #state: HarnessState;
  #onTransition: ((state: HarnessState) => void) | undefined;

  constructor(initial: HarnessState, options: StateStoreOptions = {}) {
    this.#state = deepFreeze(initial);
    this.#onTransition = options.onTransition;
  }

  /** Immutable snapshot of the current state. */
  get(): HarnessState {
    return this.#state;
  }

  /**
   * Apply a transition. Every transition stamps `updatedAt` and, when a
   * phase/event is supplied, appends an entry to the run history so the full
   * project history is reconstructable.
   */
  transact(patch: StatePatch, options: TransactOptions = {}): HarnessState {
    const current = this.#state;
    const resolved = typeof patch === "function" ? patch(current) : patch;
    const ts = nowIso();

    const history = [...current.history];
    if (options.phase !== undefined || options.event !== undefined) {
      history.push({
        ts,
        phase: options.phase ?? current.phase,
        event: options.event ?? "transition",
        note: options.note ?? "",
      });
    }

    const next: HarnessState = {
      ...current,
      ...resolved,
      phase: options.phase ?? resolved.phase ?? current.phase,
      history,
      updatedAt: ts,
    };
    this.#state = deepFreeze(next);
    if (this.#onTransition) {
      try {
        this.#onTransition(this.#state);
      } catch {
        /* a failed checkpoint must never break the run */
      }
    }
    return this.#state;
  }

  log(level: LogLevel, source: string, message: string, data: Record<string, unknown> | null = null): HarnessState {
    const entry: LogEntry = { ts: nowIso(), level, source, message, data };
    return this.transact((s) => ({ logs: [...s.logs, entry] }));
  }

  setPhase(phase: Phase, event: string, note = ""): HarnessState {
    return this.transact({ phase }, { phase, event, note });
  }

  setStatus(status: RunStatus): HarnessState {
    return this.transact({ status });
  }

  setProfile(profile: ProjectProfile): HarnessState {
    return this.transact({ profile, mode: profile.mode });
  }

  setGit(git: GitInfo): HarnessState {
    return this.transact({ git });
  }

  setPlan(plan: Plan): HarnessState {
    return this.transact({ plan, tasks: plan.tasks }, { event: "plan:set", note: `${plan.tasks.length} task(s)` });
  }

  setIndex(index: RepoIndex): HarnessState {
    return this.transact({ index }, { event: "index:set", note: `${index.entries.length} file(s) indexed` });
  }

  addTask(task: Task): HarnessState {
    return this.transact((s) => ({ tasks: [...s.tasks, task] }), { event: "task:add", note: task.id });
  }

  updateTask(id: string, patch: Partial<Task>): HarnessState {
    return this.transact(
      (s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }),
      { event: "task:update", note: id },
    );
  }

  setTaskStatus(id: string, status: TaskStatus, lastError: string | null = null): HarnessState {
    return this.transact(
      (s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, lastError } : t)),
      }),
      { event: "task:status", note: `${id} -> ${status}` },
    );
  }

  addDiff(diff: FileDiff): HarnessState {
    return this.transact(
      (s) => ({
        diffs: [...s.diffs, diff],
        metrics: { ...s.metrics, filesWritten: s.metrics.filesWritten + 1 },
      }),
      { event: "diff:add", note: `${diff.action} ${diff.path}` },
    );
  }

  addTestRun(run: TestRun): HarnessState {
    return this.transact(
      (s) => ({
        testRuns: [...s.testRuns, run],
        metrics: {
          ...s.metrics,
          testsPassed: s.metrics.testsPassed + (run.ok ? 1 : 0),
          testsFailed: s.metrics.testsFailed + (run.ok ? 0 : 1),
        },
      }),
      { event: "test:run", note: `${run.stage} ${run.ok ? "ok" : "fail"}` },
    );
  }

  addReview(finding: ReviewFinding): HarnessState {
    return this.transact((s) => ({ reviews: [...s.reviews, finding] }), { event: "review:finding", note: finding.severity });
  }

  addSecurity(finding: SecurityFinding): HarnessState {
    return this.transact((s) => ({ security: [...s.security, finding] }), {
      event: "security:finding",
      note: finding.severity,
    });
  }

  mergeMemory(entries: Record<string, string>): HarnessState {
    return this.transact((s) => ({ memory: { ...s.memory, ...entries } }), { event: "memory:merge" });
  }

  bumpMetrics(patch: Partial<Metrics>): HarnessState {
    return this.transact((s) => {
      const next = { ...s.metrics } as { -readonly [K in keyof Metrics]: Metrics[K] };
      for (const key of Object.keys(patch) as (keyof Metrics)[]) {
        if (key === "startedAt") continue;
        const delta = patch[key];
        if (typeof delta === "number") {
          next[key] = (next[key] ?? 0) + delta;
        }
      }
      return { metrics: next };
    });
  }
}
