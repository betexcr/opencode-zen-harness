/**
 * Orchestrator — the central async state-machine loop controller and data
 * router. Agent slot #5, routed through step-5-preview-free.
 *
 * It owns the full lifecycle: discovery -> planning -> exploration -> per-task
 * build/test/debug/review/security cycles -> release gate. Every agent hop is
 * funnelled through a strict retry boundary and every mutation is committed to
 * the immutable HarnessState.
 */

import type { AgentRouting } from "../config/models.ts";
import { AgentError, err, errorMessage, isFatalModelError, isRetryableError, ok, withRetry, type Result } from "../core/errors.ts";
import type { StateStore } from "../core/state.ts";
import type { FileDiff, LogLevel, Metrics, ProjectProfile, Task, TestRun } from "../core/types.ts";
import { discover, discoverProfile, ensureGitIdentity } from "../discovery/discovery.ts";
import type { AgentContext, MutationRecord, ToolName } from "../agents/base.ts";
import { BaseAgent } from "../agents/base.ts";
import { Builder } from "../agents/builder.ts";
import { Debugger } from "../agents/debugger.ts";
import { Planner } from "../agents/planner.ts";
import { ReleaseAgent } from "../agents/release.ts";
import { RepoExplorer } from "../agents/repoExplorer.ts";
import { Reviewer } from "../agents/reviewer.ts";
import { SecurityAuditor } from "../agents/securityAuditor.ts";
import { TestEngineer } from "../agents/testEngineer.ts";
import type { LLMClient } from "../llm/client.ts";
import type { SystemToolbox } from "../tools/toolbox.ts";

export interface OrchestratorConfig {
  readonly goal: string;
  readonly store: StateStore;
  readonly client: LLMClient;
  readonly toolbox: SystemToolbox;
  readonly routing: AgentRouting;
  readonly maxSteps: number;
  readonly maxRetries: number;
  readonly maxDebugAttempts: number;
  readonly maxBuildCycles: number;
  readonly contextBudgetBytes: number;
  readonly verbose: boolean;
}

interface RoutingDecision {
  readonly action: "proceed" | "rebuild" | "abort";
  readonly reason: string;
}

/**
 * Declarative routing helper: the only LLM call the orchestrator makes directly.
 * Used to adjudicate whether review findings justify another build cycle.
 */
class RoutingDecider extends BaseAgent<RoutingDecision> {
  readonly role = "orchestrator" as const;
  protected allowedTools(): readonly ToolName[] {
    return [];
  }
  protected systemPrompt(): string {
    return [
      "You are the ORCHESTRATOR routing brain. You receive review/security feedback for a task and decide the next step.",
      "Choose 'rebuild' only if there is a concrete, fixable blocker/major issue and attempts remain.",
      "Choose 'abort' if the task is fundamentally misconceived. Otherwise 'proceed'.",
      'Final shape: {"action": "proceed|rebuild|abort", "reason": string}',
    ].join("\n");
  }
  protected override finalize(value: unknown): RoutingDecision {
    const obj = (value ?? {}) as Record<string, unknown>;
    const action = obj.action === "rebuild" || obj.action === "abort" ? obj.action : "proceed";
    return { action, reason: typeof obj.reason === "string" ? obj.reason : "" };
  }
}

export class Orchestrator {
  readonly #cfg: OrchestratorConfig;
  #fatal: Error | null = null;

  constructor(cfg: OrchestratorConfig) {
    this.#cfg = cfg;
  }

  get #store(): StateStore {
    return this.#cfg.store;
  }

  async run(): Promise<void> {
    const { store } = this.#cfg;
    const resuming = store.get().plan !== null;
    store.setStatus("running");

    if (resuming) {
      this.#normalizeResumed();
      const s = store.get();
      const done = s.tasks.filter((t) => t.status === "done").length;
      this.log("info", "orchestrator", `resuming run ${s.runId} (phase=${s.phase}, ${done}/${s.tasks.length} task(s) done) - ${this.#cfg.goal}`);
    } else {
      this.log("info", "orchestrator", `run started: ${this.#cfg.goal}`);

      // 1) Discovery + git safety lock.
      store.setPhase("discovery", "discovery:start", "scanning workspace");
      const discovered = await discover(this.#cfg.toolbox, store.get().runId);
      store.setProfile(discovered.profile);
      store.setGit(discovered.git);
      this.log("info", "discovery", `mode=${discovered.profile.mode} language=${discovered.profile.language} git=${discovered.git.isRepo}`);
      if (discovered.git.createdScratch) {
        this.log("warn", "discovery", `dirty tree detected; cut scratch branch ${discovered.git.scratchBranch}`);
      }

      // 2) Planning.
      store.setPhase("planning", "planning:start", "decomposing goal");
      const plan = await this.#plan();
      if (this.#fatal) return this.#abortFatal();
      if (plan.tasks.length === 0) {
        this.log("warn", "orchestrator", "planner returned no tasks; nothing to do");
        store.setStatus("succeeded");
        store.setPhase("done", "run:done", "no tasks");
        return;
      }
      this.log("info", "planner", `plan: ${plan.tasks.length} task(s) - ${plan.summary}`);
    }

    // 3) Exploration (structural index) for existing projects, unless already indexed.
    if (store.get().profile.mode === "existing" && store.get().index === null) {
      store.setPhase("exploring", "exploring:start", "indexing repository");
      await this.#explore();
      if (this.#fatal) return this.#abortFatal();
    }

    // 4) Per-task cycles respecting dependency order.
    for (const task of this.#orderedTasks()) {
      if (this.#fatal) return this.#abortFatal();
      if (task.status === "done") continue;
      const outcome = await this.#runTask(task);
      if (!outcome) {
        this.log("error", "orchestrator", `task ${task.id} could not be completed; aborting downstream work`);
        store.setTaskStatus(task.id, "blocked", "unrecoverable");
      }
    }
    if (this.#fatal) return this.#abortFatal();

    // 5) Release gate.
    await this.#release();
    if (this.#fatal) return this.#abortFatal();

    const allDone = store.get().tasks.every((t) => t.status === "done");
    store.setStatus(allDone ? "succeeded" : "failed");
    store.setPhase(allDone ? "done" : "failed", "run:end", allDone ? "all tasks verified" : "one or more tasks failed");
    this.#printSummary();
  }

  // ---------------------------------------------------------------------------
  // Phase implementations
  // ---------------------------------------------------------------------------

  async #plan(): Promise<import("../core/types.ts").Plan> {
    const { store, toolbox } = this.#cfg;
    const state = store.get();
    const files = await toolbox.listFiles(".", { maxFiles: 500 });
    const planner = new Planner();
    const ctx = planner.makeContext(this.#baseContext());
    const input = {
      goal: state.goal,
      mode: state.profile.mode,
      profile: state.profile,
      phase: state.phase,
      existingFiles: files.slice(0, 300),
      indexSummary: state.index ? state.index.entries.map((e) => `${e.path} (${e.role})`).join("\n") : null,
      priorPlan: null,
    };
    const result = await this.#guard("planner", planner, input, ctx);
    if (result.ok) {
      store.setPlan(result.value.final);
      return result.value.final;
    }
    this.log("error", "planner", `planning failed: ${errorMessage(result.error)}`);
    store.setPlan({ summary: "fallback: single task", tasks: [this.#fallbackTask(state.goal)] });
    return store.get().plan!;
  }

  async #explore(): Promise<void> {
    const { store, toolbox } = this.#cfg;
    const explorer = new RepoExplorer();
    const ctx = explorer.makeContext(this.#baseContext());
    const files = await toolbox.listFiles(".", { maxFiles: 800 });
    const result = await this.#guard("repo-explorer", explorer, {
      goal: store.get().goal,
      candidateFiles: files.slice(0, 500),
      mode: store.get().profile.mode,
      frameworkHint: null,
    }, ctx);
    if (result.ok) {
      store.setIndex(result.value.final);
      this.log("info", "repo-explorer", `indexed ${result.value.final.entries.length} file(s)`);
    } else {
      this.log("warn", "repo-explorer", `exploration failed: ${errorMessage(result.error)}`);
    }
  }

  async #runTask(task: Task): Promise<boolean> {
    const { store } = this.#cfg;
    store.setTaskStatus(task.id, "in-progress");
    store.setPhase("building", "task:build", task.id);
    this.log("info", "orchestrator", `task ${task.id}: ${task.title}`);

    let feedback: string | null = null;

    for (let cycle = 1; cycle <= this.#cfg.maxBuildCycles; cycle++) {
      // Build
      const builder = new Builder(task.id);
      const buildResult = await this.#guard(
        "builder",
        builder,
        {
          goal: store.get().goal,
          mode: store.get().profile.mode,
          profile: store.get().profile,
          task,
          context: await this.#buildContext(task),
          priorFeedback: feedback,
        },
        builder.makeContext(this.#baseContext()),
      );
      if (!buildResult.ok) {
        store.updateTask(task.id, { attempts: task.attempts + cycle, lastError: errorMessage(buildResult.error) });
        return false;
      }
      this.log("info", "builder", `task ${task.id}: wrote ${buildResult.value.final.files.length} file(s)`);

      // Tests (author + run)
      store.setPhase("testing", "task:test", task.id);
      const testEngineer = new TestEngineer(task.id);
      const testResult = await this.#guard(
        "test-engineer",
        testEngineer,
        {
          goal: store.get().goal,
          profile: store.get().profile,
          task,
          changedFiles: this.#taskDiffs(task.id).map((d) => d.path),
          context: await this.#buildContext(task),
        },
        testEngineer.makeContext(this.#baseContext()),
      );
      const extraCommands = testResult.ok ? testResult.value.final.commands : [];

      const testOk = await this.#runAndDebug(task, extraCommands);

      // Review
      store.setPhase("reviewing", "task:review", task.id);
      const reviewApproved = await this.#review(task);

      // Security
      store.setPhase("security", "task:security", task.id);
      const securityOk = await this.#audit(task);

      if (testOk && reviewApproved && securityOk) {
        store.setTaskStatus(task.id, "done");
        this.log("info", "orchestrator", `task ${task.id}: verified`);
        return true;
      }

      // Adjudicate whether to rebuild.
      const decision = await this.#decide(task, { testOk, reviewApproved, securityOk, cycle });
      if (decision.action === "proceed") {
        store.setTaskStatus(task.id, "done");
        this.log("warn", "orchestrator", `task ${task.id}: accepted with warnings (${decision.reason})`);
        return true;
      }
      if (decision.action === "abort" || cycle >= this.#cfg.maxBuildCycles) {
        store.setTaskStatus(task.id, "failed", `unresolved after ${cycle} cycle(s)`);
        return false;
      }
      feedback = this.#feedbackFromState(task.id);
      this.log("warn", "orchestrator", `task ${task.id}: rebuild cycle ${cycle + 1} (${decision.reason})`);
    }
    return false;
  }

  /** Run the task's test command; on failure, hand logs to the Debugger and retry. */
  async #runAndDebug(task: Task, extraCommands: readonly string[]): Promise<boolean> {
    const { store, toolbox } = this.#cfg;
    const commands = this.#testCommands(task, extraCommands);

    for (let attempt = 1; attempt <= this.#cfg.maxDebugAttempts; attempt++) {
      let allOk = true;
      let lastRun: TestRun | null = null;
      for (const command of commands) {
        const run = await this.#executeStage(task, "unit", command);
        if (!run.ok) {
          allOk = false;
          lastRun = run;
          break;
        }
      }
      if (allOk) return true;

      if (!lastRun || attempt >= this.#cfg.maxDebugAttempts) {
        this.log("error", "orchestrator", `task ${task.id}: tests failing after ${attempt} attempt(s)`);
        return false;
      }

      store.setPhase("debugging", "task:debug", `${task.id} attempt ${attempt}`);
      this.log("warn", "debugger", `task ${task.id}: debugging failed run '${lastRun.command}'`);
      const debuggerAgent = new Debugger(task.id);
      const debugResult = await this.#guard(
        "debugger",
        debuggerAgent,
        {
          goal: store.get().goal,
          profile: store.get().profile,
          task,
          failedRun: lastRun,
          context: await this.#buildContext(task),
          attempt,
        },
        debuggerAgent.makeContext(this.#baseContext()),
      );
      if (!debugResult.ok) return false;
      if (debugResult.value.final.patchedFiles.length === 0) {
        this.log("warn", "debugger", `task ${task.id}: no patch produced`);
        return false;
      }
      this.log("info", "debugger", `task ${task.id}: ${debugResult.value.final.diagnosis}`);
      void toolbox;
    }
    return false;
  }

  async #review(task: Task): Promise<boolean> {
    const { store } = this.#cfg;
    const reviewer = new Reviewer();
    const diffs = this.#taskDiffs(task.id);
    const result = await this.#guard(
      "reviewer",
      reviewer,
      {
        goal: store.get().goal,
        profile: store.get().profile,
        task,
        diffs,
        changedFiles: diffs.map((d) => d.path),
        context: await this.#buildContext(task),
      },
      reviewer.makeContext(this.#baseContext()),
    );
    if (!result.ok) {
      this.log("warn", "reviewer", `review failed to run: ${errorMessage(result.error)}`);
      return false;
    }
    const report = result.value.final;
    for (const finding of report.findings) {
      store.addReview({ severity: finding.severity, file: finding.file, detail: finding.detail, goalAlignment: finding.goalAlignment });
    }
    this.log(report.approved ? "info" : "warn", "reviewer", `${task.id}: approved=${report.approved} - ${report.summary}`);
    return report.approved;
  }

  async #audit(task: Task): Promise<boolean> {
    const { store } = this.#cfg;
    const auditor = new SecurityAuditor();
    const diffs = this.#taskDiffs(task.id);
    const result = await this.#guard(
      "security-auditor",
      auditor,
      { goal: store.get().goal, diffs, changedFiles: diffs.map((d) => d.path) },
      auditor.makeContext(this.#baseContext()),
    );
    if (!result.ok) {
      this.log("warn", "security-auditor", `audit failed to run: ${errorMessage(result.error)}`);
      return false;
    }
    const report = result.value.final;
    for (const finding of report.findings) {
      store.addSecurity({
        severity: finding.severity,
        category: finding.category,
        file: finding.file,
        detail: finding.detail,
        recommendation: finding.recommendation,
      });
    }
    this.log(report.safe ? "info" : "warn", "security-auditor", `${task.id}: safe=${report.safe} - ${report.summary}`);
    return report.safe;
  }

  async #decide(
    task: Task,
    status: { testOk: boolean; reviewApproved: boolean; securityOk: boolean; cycle: number },
  ): Promise<RoutingDecision> {
    const decider = new RoutingDecider();
    const result = await this.#guard(
      "orchestrator",
      decider,
      {
        task: task.id,
        title: task.title,
        cycle: status.cycle,
        maxCycles: this.#cfg.maxBuildCycles,
        testsPassing: status.testOk,
        reviewApproved: status.reviewApproved,
        securitySafe: status.securityOk,
        reviewFindings: this.#store.get().reviews.filter((r) => r.severity !== "info").slice(-8),
        securityFindings: this.#store.get().security.slice(-8),
      },
      decider.makeContext(this.#baseContext()),
    );
    if (result.ok) return result.value.final;
    // Conservative default: if we can't decide, rebuild while cycles remain.
    return { action: status.cycle < this.#cfg.maxBuildCycles ? "rebuild" : "proceed", reason: "decider unavailable" };
  }

  async #release(): Promise<void> {
    const { store, toolbox } = this.#cfg;

    // Refresh command mapping: new projects now have manifests to detect.
    const refreshed = await discoverProfile(toolbox);
    if (refreshed.profile.language !== "unknown") {
      store.setProfile({ ...refreshed.profile, isGitRepo: store.get().git.isRepo });
    }
    const profile = store.get().profile;

    const stages: { name: string; command: string | null }[] = [
      { name: "lint", command: profile.commands.lint },
      { name: "build", command: profile.commands.build },
      { name: "test", command: profile.commands.test },
    ];
    const runnable = stages.filter((s): s is { name: string; command: string } => typeof s.command === "string");

    const anyFailure = store.get().tasks.some((t) => t.status !== "done");
    const commitMessage = `feat(harness): ${store.get().goal.split("\n")[0]?.slice(0, 68) ?? "autonomous change"}`;

    if (runnable.length === 0) {
      this.log("warn", "release", "no runnable verification commands detected for this stack");
      return;
    }

    store.setPhase("releasing", "release:start", `${runnable.length} stage(s)`);
    if (store.get().git.isRepo) await ensureGitIdentity(toolbox);

    const releaseAgent = new ReleaseAgent();
    const result = await this.#guard(
      "release",
      releaseAgent,
      {
        goal: store.get().goal,
        profile,
        stages: runnable,
        commitMessage: !anyFailure && store.get().git.isRepo ? commitMessage : null,
        git: { isRepo: store.get().git.isRepo, branch: store.get().git.branch },
      },
      releaseAgent.makeContext(this.#baseContext()),
    );

    if (!result.ok) {
      this.log("error", "release", `release gate failed to run: ${errorMessage(result.error)}`);
      return;
    }
    const report = result.value.final;
    for (const stage of report.stages) {
      store.addTestRun({
        stage: stage.stage,
        command: stage.command,
        ok: stage.ok,
        exitCode: stage.exitCode,
        stdout: stage.output.slice(0, 8_000),
        stderr: "",
        durationMs: 0,
        taskId: null,
        ranAt: new Date().toISOString(),
      });
    }
    this.log(report.committed ? "info" : "warn", "release", `stages=${report.stages.length} committed=${report.committed} sha=${report.commitSha ?? "-"}`);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async #executeStage(task: Task, stage: TestRun["stage"], command: string): Promise<TestRun> {
    const { store, toolbox } = this.#cfg;
    store.bumpMetrics({ commandsRun: 1 });
    this.log("info", "release", `run[${task.id}] ${stage}: ${command}`);
    const result = await toolbox.runCommand(command);
    const run: TestRun = {
      stage,
      command,
      ok: result.code === 0 && !result.timedOut,
      exitCode: result.code,
      stdout: result.stdout.slice(0, 12_000),
      stderr: result.stderr.slice(0, 12_000),
      durationMs: result.durationMs,
      taskId: task.id,
      ranAt: new Date().toISOString(),
    };
    store.addTestRun(run);
    if (!run.ok) {
      this.log("error", "release", `run[${task.id}] ${stage} failed (exit ${result.code ?? "null"})`);
    }
    return run;
  }

  async #guard<T>(
    label: string,
    agent: BaseAgent<T>,
    input: unknown,
    ctx: AgentContext,
  ): Promise<Result<import("../agents/base.ts").AgentOutcome<T>>> {
    const { store } = this.#cfg;
    this.log("debug", "boundary", `invoke ${label} -> ${ctx.model}`);
    try {
      const outcome = await withRetry(() => agent.invoke(input, ctx), {
        retries: this.#cfg.maxRetries,
        isRetryable: (error) => {
          if (error instanceof AgentError && /not permitted/.test(error.message)) return false;
          return isRetryableError(error);
        },
        onRetry: (error, attempt, delay) => {
          store.bumpMetrics({ retries: 1 });
          this.log("warn", "boundary", `${label} retry ${attempt} in ${delay}ms: ${errorMessage(error)}`);
        },
      });
      return ok(outcome);
    } catch (error) {
      if (isFatalModelError(error)) {
        this.#fatal = error instanceof Error ? error : new Error(String(error));
        store.log("error", label, `FATAL: ${errorMessage(error)}`);
        store.log(
          "error",
          label,
          "non-retryable authorization/transport error (e.g. the Zen free-tier gate). " +
            "Point each role at an openai-compatible model your API key can call via " +
            "HARNESS_MODEL_<ROLE> (or a global HARNESS_MODEL), then re-run.",
        );
      } else {
        store.log("error", label, `agent boundary caught: ${errorMessage(error)}`);
      }
      return err(error);
    }
  }

  #abortFatal(): void {
    const { store } = this.#cfg;
    store.setStatus("failed");
    store.setPhase("failed", "run:aborted", "fatal configuration/auth error");
    this.log("error", "orchestrator", `run aborted: ${errorMessage(this.#fatal)}`);
    this.#printSummary();
  }

  /** On resume, re-queue any task that was mid-flight when the run was interrupted. */
  #normalizeResumed(): void {
    for (const task of this.#store.get().tasks) {
      if (task.status === "in-progress") {
        this.#store.setTaskStatus(task.id, "pending", task.lastError);
      }
    }
  }

  #baseContext(): Omit<AgentContext, "role" | "model" | "generation"> & { routing: AgentRouting } {
    return {
      client: this.#cfg.client,
      toolbox: this.#cfg.toolbox,
      store: this.#cfg.store,
      maxSteps: this.#cfg.maxSteps,
      routing: this.#cfg.routing,
      recordDiff: (mutation: MutationRecord) => {
        this.#store.addDiff({
          path: mutation.path,
          action: mutation.action,
          unifiedDiff: mutation.unifiedDiff,
          taskId: mutation.taskId,
          appliedAt: new Date().toISOString(),
        });
      },
    };
  }

  #taskDiffs(taskId: string): FileDiff[] {
    return this.#store.get().diffs.filter((d) => d.taskId === taskId);
  }

  #orderedTasks(): Task[] {
    const tasks = [...this.#store.get().tasks];
    const done = new Set<string>();
    const order: Task[] = [];
    const remaining = [...tasks];
    let progressed = true;
    while (remaining.length > 0 && progressed) {
      progressed = false;
      for (let i = 0; i < remaining.length; i++) {
        const task = remaining[i]!;
        if (task.dependsOn.every((dep) => done.has(dep))) {
          order.push(task);
          done.add(task.id);
          remaining.splice(i, 1);
          progressed = true;
          break;
        }
      }
    }
    // Any tasks with unmet/cyclic deps are appended so they are still attempted.
    order.push(...remaining);
    return order;
  }

  #testCommands(task: Task, extra: readonly string[]): string[] {
    const commands = [...extra, ...task.commands].filter((c) => typeof c === "string" && c.length > 0);
    if (commands.length === 0 && this.#store.get().profile.commands.test) {
      commands.push(this.#store.get().profile.commands.test!);
    }
    return [...new Set(commands)];
  }

  async #buildContext(task: Task): Promise<string> {
    const { store, toolbox } = this.#cfg;
    const index = store.get().index;
    const candidate = [...new Set([...task.files, ...(index?.relevantToGoal ?? [])])].slice(0, 24);
    const chunks: string[] = [];
    let budget = this.#cfg.contextBudgetBytes;
    for (const file of candidate) {
      if (budget <= 0) break;
      try {
        if (!(await toolbox.exists(file)) || (await toolbox.isDirectory(file))) continue;
        const content = await toolbox.readFile(file, 48 * 1024);
        const slice = content.slice(0, Math.min(content.length, budget));
        budget -= Buffer.byteLength(slice, "utf8");
        chunks.push(`----- ${file} -----\n${slice}`);
      } catch {
        continue;
      }
    }
    if (index) {
      chunks.unshift(
        `INDEX:\n${index.entries.map((e) => `- ${e.path} [${e.role}] ${e.summary}`).join("\n")}`,
      );
    }
    return chunks.join("\n\n") || "(no relevant files resolved from context)";
  }

  #feedbackFromState(taskId: string): string {
    const store = this.#store.get();
    const diffs = store.diffs.filter((d) => d.taskId === taskId).map((d) => d.path);
    const lines = [
      `Previous attempt for task ${taskId} failed. Files touched: ${diffs.join(", ") || "(none)"}.`,
    ];
    const recentTests = store.testRuns.filter((t) => t.taskId === taskId).slice(-2);
    for (const run of recentTests) {
      lines.push(`Failed command '${run.command}' exit ${run.exitCode}: ${run.stderr.slice(0, 800) || run.stdout.slice(0, 800)}`);
    }
    const reviewFindings = store.reviews.filter((r) => r.severity !== "info").slice(-4);
    for (const finding of reviewFindings) {
      lines.push(`Reviewer (${finding.severity}) ${finding.file ?? "-"}: ${finding.detail}`);
    }
    return lines.join("\n");
  }

  #fallbackTask(goal: string): Task {
    return {
      id: "task-1",
      title: "Implement requested change",
      description: goal,
      files: [],
      commands: [],
      acceptance: ["The requested change is implemented and tests pass."],
      dependsOn: [],
      status: "pending",
      attempts: 0,
      lastError: null,
    };
  }

  #printSummary(): void {
    const state = this.#store.get();
    const m: Metrics = state.metrics;
    this.log("info", "orchestrator", `run ${state.status.toUpperCase()} in ${Date.now() - Date.parse(m.startedAt)}ms`);
    this.log(
      "info",
      "orchestrator",
      `calls=${m.agentCalls} retries=${m.retries} tokensIn=${m.tokensIn} tokensOut=${m.tokensOut} files=${m.filesWritten} testsPassed=${m.testsPassed} testsFailed=${m.testsFailed}`,
    );
  }

  private log(level: LogLevel, source: string, message: string): void {
    this.#cfg.store.log(level, source, message);
    if (!this.#cfg.verbose) return;
    const prefix = level.toUpperCase().padEnd(5);
    const line = `[${prefix}] ${source}: ${message}`;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }
}
