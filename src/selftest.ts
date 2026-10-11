#!/usr/bin/env node
/**
 * Hermetic self-test suite. Exercises the sandbox, gitignore engine, unified
 * diff engine, dual-mode discovery, git safety lock, and — most importantly —
 * a full multi-agent orchestration loop driven by a deterministic mock LLM.
 *
 * No network access, no API key, no external services required.
 *
 *   node src/selftest.ts [--verbose]
 */

import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { StateStore, createInitialState } from "./core/state.ts";
import { SandboxViolation } from "./core/errors.ts";
import { MockLLMClient } from "./llm/client.ts";
import { ModelCallError, RetryExhaustedError, isFatalModelError, isRetryableError, withRetry } from "./core/errors.ts";
import { parseEvents } from "./llm/opencodeCliClient.ts";
import {
  CHECKPOINT_VERSION,
  Checkpointer,
  CheckpointError,
  checkpointPath,
  parseCheckpoint,
  readCheckpoint,
  serializeCheckpoint,
  writeCheckpoint,
} from "./core/checkpoint.ts";
import { SystemToolbox } from "./tools/toolbox.ts";
import { Orchestrator } from "./orchestration/orchestrator.ts";
import { AGENT_MODEL_ROUTING } from "./config/models.ts";
import { applyUnifiedDiff, createUnifiedDiff, parseUnifiedDiff } from "./tools/diff.ts";
import { buildIgnoreMatcher, compileGitignore, resolveInSandbox } from "./tools/sandbox.ts";
import { discoverProfile, gitSafetyLock } from "./discovery/discovery.ts";
import type { ProjectProfile } from "./core/types.ts";

interface CaseResult {
  readonly name: string;
  readonly ok: boolean;
  readonly message: string;
}

const results: CaseResult[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    results.push({ name, ok: true, message: "" });
  } catch (error) {
    results.push({ name, ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function makeTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), `zen-harness-${prefix}-`));
}

async function rmrf(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

function blankProfile(mode: "new" | "existing" = "new"): ProjectProfile {
  return {
    mode,
    language: "unknown",
    packageManager: null,
    signatureFiles: [],
    commands: { install: null, build: null, test: null, lint: null, format: null, run: null },
    isGitRepo: false,
    notes: [],
  };
}

const NO_GIT = {
  isRepo: false,
  branch: null,
  dirtyBefore: false,
  scratchBranch: null,
  createdScratch: false,
  baseCommit: null,
} as const;

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

async function sandboxCases(): Promise<void> {
  const root = await makeTempDir("sandbox");
  try {
    await test("sandbox: allows paths inside the root", () => {
      const resolved = resolveInSandbox(root, "src/app.ts");
      assert(resolved.startsWith(root), "resolved path should be inside root");
    });

    await test("sandbox: rejects parent traversal", () => {
      let threw = false;
      try {
        resolveInSandbox(root, "../../etc/passwd");
      } catch (error) {
        threw = error instanceof SandboxViolation;
      }
      assert(threw, "expected SandboxViolation for traversal");
    });

    await test("sandbox: rejects absolute escape", () => {
      const outside = path.resolve(root, "..", "..", "system-file");
      let threw = false;
      try {
        resolveInSandbox(root, outside);
      } catch (error) {
        threw = error instanceof SandboxViolation;
      }
      assert(threw, "expected SandboxViolation for absolute escape");
    });

    await test("toolbox: readFile is sandboxed", async () => {
      const tb = await SystemToolbox.create({ root });
      let threw = false;
      try {
        await tb.readFile("../outside.txt");
      } catch (error) {
        threw = error instanceof SandboxViolation;
      }
      assert(threw, "expected SandboxViolation from readFile");
    });

    await test("toolbox: write + read roundtrip", async () => {
      const tb = await SystemToolbox.create({ root });
      const written = await tb.writeFile("nested/dir/file.txt", "hello world");
      assert(written.created, "file should be newly created");
      const content = await tb.readFile("nested/dir/file.txt");
      assert(content === "hello world", "content mismatch");
    });

    await test("toolbox: destructive command guard blocks rm -rf /", async () => {
      const tb = await SystemToolbox.create({ root });
      let threw = false;
      try {
        await tb.runCommand("rm -rf /");
      } catch (error) {
        threw = error instanceof SandboxViolation;
      }
      assert(threw, "expected destructive command to be blocked");
    });
  } finally {
    await rmrf(root);
  }
}

async function gitignoreCases(): Promise<void> {
  await test("gitignore: default dirs excluded", () => {
    const matcher = buildIgnoreMatcher(null);
    assert(matcher.ignores("node_modules/react/index.js", false), "node_modules should be ignored");
    assert(matcher.ignores(".venv/lib/python3.11/site.py", false), ".venv should be ignored");
    assert(!matcher.ignores("src/app.ts", false), "src/app.ts should be visible");
  });

  await test("gitignore: custom patterns + negation", () => {
    const matcher = compileGitignore(["*.log", "dist/", "!keep.log"].join("\n"));
    assert(matcher.ignores("server.log", false), "*.log should match at any depth");
    assert(matcher.ignores("dist", true), "dist/ should be ignored as a directory");
    assert(!matcher.ignores("keep.log", false), "negation should re-include keep.log");
  });

  await test("gitignore: anchored and double-star patterns", () => {
    const matcher = compileGitignore(["/build/", "**/generated/**"].join("\n"));
    assert(matcher.ignores("build", true), "anchored /build/ should match root build dir");
    assert(matcher.ignores("a/b/generated/c.ts", false), "**/generated/** should match nested");
  });
}

async function diffCases(): Promise<void> {
  await test("diff: create -> parse -> apply roundtrip", () => {
    const before = "line1\nline2\nline3\nline4\n";
    const after = "line1\nline2-changed\nline3\nline4\nline5\n";
    const diff = createUnifiedDiff("a/f.txt", "b/f.txt", before, after);
    assert(diff.length > 0, "diff should be non-empty");
    const parsed = parseUnifiedDiff(diff);
    assert(parsed.length === 1, "expected a single file patch");
    const applied = applyUnifiedDiff(before, diff);
    assert(applied === after, `roundtrip mismatch:\n${applied}`);
  });

  await test("diff: insertion at top", () => {
    const before = "b\nc\n";
    const after = "a\nb\nc\n";
    const diff = createUnifiedDiff("a/f", "b/f", before, after);
    assert(applyUnifiedDiff(before, diff) === after, "top insertion mismatch");
  });

  await test("diff: deletion only", () => {
    const before = "a\nb\nc\nd\n";
    const after = "a\nd\n";
    const diff = createUnifiedDiff("a/f", "b/f", before, after);
    assert(applyUnifiedDiff(before, diff) === after, "deletion mismatch");
  });

  await test("diff: fuzzy offset tolerance", () => {
    const content = "x\ny\nz\ntarget1\ntarget2\nw\n";
    const patch = "--- a/f\n+++ b/f\n@@ -20,2 +20,2 @@\n-target1\n-target2\n+target1\n+target2-mod\n";
    const applied = applyUnifiedDiff(content, patch);
    assert(applied.includes("target2-mod"), "fuzzy apply should locate the block despite wrong offset");
  });

  await test("toolbox: applyPatch persists to disk", async () => {
    const root = await makeTempDir("patch");
    try {
      const tb = await SystemToolbox.create({ root });
      await tb.writeFile("f.txt", "alpha\nbeta\n");
      const diff = createUnifiedDiff("a/f.txt", "b/f.txt", "alpha\nbeta\n", "alpha\nBETA\n");
      const result = await tb.applyPatch("f.txt", diff);
      assert(result.after === "alpha\nBETA\n", "patched content mismatch");
      assert((await tb.readFile("f.txt")) === "alpha\nBETA\n", "persisted content mismatch");
    } finally {
      await rmrf(root);
    }
  });
}

async function discoveryCases(): Promise<void> {
  await test("discovery: empty dir -> new project mode", async () => {
    const root = await makeTempDir("new");
    try {
      const tb = await SystemToolbox.create({ root });
      const { profile } = await discoverProfile(tb);
      assert(profile.mode === "new", `expected new mode, got ${profile.mode}`);
      assert(profile.commands.test === null, "new mode should have no test command yet");
    } finally {
      await rmrf(root);
    }
  });

  await test("discovery: package.json -> npm + typescript", async () => {
    const root = await makeTempDir("node");
    try {
      await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ name: "x" }), "utf8");
      await fs.writeFile(path.join(root, "tsconfig.json"), "{}", "utf8");
      await fs.writeFile(path.join(root, "index.ts"), "export {};\n", "utf8");
      const tb = await SystemToolbox.create({ root });
      const { profile } = await discoverProfile(tb);
      assert(profile.mode === "existing", "should be existing mode");
      assert(profile.language === "typescript", `expected typescript, got ${profile.language}`);
      assert(profile.commands.test === "npm test", `expected npm test, got ${profile.commands.test}`);
    } finally {
      await rmrf(root);
    }
  });

  await test("discovery: requirements.txt -> pytest", async () => {
    const root = await makeTempDir("py");
    try {
      await fs.writeFile(path.join(root, "requirements.txt"), "flask\n", "utf8");
      await fs.writeFile(path.join(root, "app.py"), "print('hi')\n", "utf8");
      const tb = await SystemToolbox.create({ root });
      const { profile } = await discoverProfile(tb);
      assert(profile.language === "python", `expected python, got ${profile.language}`);
      assert(profile.commands.test === "pytest", `expected pytest, got ${profile.commands.test}`);
    } finally {
      await rmrf(root);
    }
  });

  await test("discovery: pnpm lockfile remaps commands", async () => {
    const root = await makeTempDir("pnpm");
    try {
      await fs.writeFile(path.join(root, "package.json"), "{}", "utf8");
      await fs.writeFile(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: 9\n", "utf8");
      await fs.writeFile(path.join(root, "index.js"), "console.log(1)\n", "utf8");
      const tb = await SystemToolbox.create({ root });
      const { profile } = await discoverProfile(tb);
      assert(profile.packageManager === "pnpm", "should detect pnpm");
      assert(profile.commands.test === "pnpm test", `expected pnpm test, got ${profile.commands.test}`);
    } finally {
      await rmrf(root);
    }
  });
}

async function gitSafetyCases(): Promise<void> {
  await test("git safety lock: clean repo stays on branch", async () => {
    const root = await makeTempDir("gitclean");
    try {
      const tb = await SystemToolbox.create({ root });
      await tb.runCommand("git init");
      await tb.runCommand('git config user.email "t@t.t"');
      await tb.runCommand('git config user.name "tester"');
      await tb.writeFile("a.txt", "hello\n");
      await tb.runCommand("git add -A && git commit -m init");
      const info = await gitSafetyLock(tb, "run-clean");
      assert(info.isRepo, "should detect repo");
      assert(info.createdScratch === false, "clean repo should not create a scratch branch");
    } finally {
      await rmrf(root);
    }
  });

  await test("git safety lock: dirty repo cuts scratch branch", async () => {
    const root = await makeTempDir("gitdirty");
    try {
      const tb = await SystemToolbox.create({ root });
      await tb.runCommand("git init");
      await tb.runCommand('git config user.email "t@t.t"');
      await tb.runCommand('git config user.name "tester"');
      await tb.writeFile("a.txt", "hello\n");
      await tb.runCommand("git add -A && git commit -m init");
      await tb.writeFile("a.txt", "hello modified\n");
      const info = await gitSafetyLock(tb, "run-dirty");
      assert(info.dirtyBefore, "should detect dirty tree");
      assert(info.createdScratch, "should have created a scratch branch");
      assert(
        info.scratchBranch !== null && info.scratchBranch.startsWith("opencode-agent/patch-"),
        `unexpected scratch branch name: ${info.scratchBranch}`,
      );
    } finally {
      await rmrf(root);
    }
  });
}

function buildMockScript(): string[] {
  const responses: unknown[] = [];

  responses.push({
    thought: "decompose the goal",
    final: {
      summary: "Bootstrap a hello module and its manifest.",
      tasks: [
        {
          id: "task-1",
          title: "Create hello module and manifest",
          description: "Add package.json and an exported hello() function.",
          files: ["package.json", "src/hello.ts"],
          commands: [],
          acceptance: ["hello() returns a greeting"],
          dependsOn: [],
        },
      ],
    },
  });

  responses.push({
    thought: "write the manifest",
    tool: "write_file",
    args: { path: "package.json", content: JSON.stringify({ name: "selftest-proj", version: "1.0.0", type: "module" }, null, 2) + "\n" },
  });
  responses.push({
    thought: "write the module",
    tool: "write_file",
    args: { path: "src/hello.ts", content: "export const hello = (name: string): string => `hello ${name}`;\n" },
  });
  responses.push({
    thought: "builder done",
    final: {
      files: [
        { path: "package.json", summary: "project manifest" },
        { path: "src/hello.ts", summary: "hello module" },
      ],
      notes: "minimal bootstrap",
    },
  });

  responses.push({
    thought: "write tests",
    tool: "write_file",
    args: {
      path: "tests/hello.test.ts",
      content: "import { hello } from '../src/hello.ts';\nif (hello('x') !== 'hello x') throw new Error('bad');\nconsole.log('ok');\n",
    },
  });
  responses.push({
    thought: "tests done",
    final: {
      testFiles: [{ path: "tests/hello.test.ts", summary: "hello assertions" }],
      commands: ['node -e "process.exit(0)"'],
      notes: "runnable without network",
    },
  });

  responses.push({
    thought: "review",
    final: { approved: true, summary: "Change satisfies the task and follows conventions.", findings: [] },
  });
  responses.push({
    thought: "audit",
    final: { safe: true, summary: "No security issues found in the changed files.", findings: [] },
  });
  responses.push({
    thought: "release",
    final: {
      stages: [{ name: "test", stage: "unit", command: 'node -e "process.exit(0)"', ok: true, exitCode: 0, output: "ok" }],
      committed: false,
      commitSha: null,
      notes: "mocked release",
    },
  });

  return responses.map((r) => JSON.stringify(r));
}

async function orchestrationCase(verbose: boolean): Promise<void> {
  const root = await makeTempDir("orch");
  try {
    await test("orchestration: full multi-agent loop reaches verified success", async () => {
      const toolbox = await SystemToolbox.create({ root });
      const client = new MockLLMClient(buildMockScript());
      const profile: ProjectProfile = {
        mode: "new",
        language: "unknown",
        packageManager: null,
        signatureFiles: [],
        commands: { install: null, build: null, test: null, lint: null, format: null, run: null },
        isGitRepo: false,
        notes: ["test bootstrap"],
      };
      const store = new StateStore(
        createInitialState({
          goal: "Create a hello module",
          workspaceRoot: toolbox.root,
          profile,
          git: { isRepo: false, branch: null, dirtyBefore: false, scratchBranch: null, createdScratch: false, baseCommit: null },
        }),
      );
      const orchestrator = new Orchestrator({
        goal: "Create a hello module",
        store,
        client,
        toolbox,
        routing: { ...AGENT_MODEL_ROUTING },
        maxSteps: 8,
        maxRetries: 2,
        maxDebugAttempts: 2,
        maxBuildCycles: 2,
        contextBudgetBytes: 32 * 1024,
        verbose,
      });
      await orchestrator.run();
      const state = store.get();

      assert(state.status === "succeeded", `expected succeeded, got ${state.status}`);
      assert(state.tasks.length === 1, "expected exactly one task");
      assert(state.tasks[0]!.status === "done", `task status was ${state.tasks[0]!.status}`);
      assert(state.diffs.some((d) => d.path === "src/hello.ts"), "expected src/hello.ts diff");
      assert(state.metrics.agentCalls === 9, `expected 9 agent calls, got ${state.metrics.agentCalls}`);
      assert(state.metrics.retries === 0, `expected 0 retries, got ${state.metrics.retries}`);
      assert(state.metrics.filesWritten === 3, `expected 3 files written, got ${state.metrics.filesWritten}`);
      assert(
        state.testRuns.some((r) => r.ok && r.command.includes("process.exit(0)")),
        "expected a passing test run",
      );
      assert((await toolbox.exists("src/hello.ts")), "src/hello.ts should exist on disk");
    });
  } finally {
    await rmrf(root);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function retryCases(): Promise<void> {
  await test("retry: non-retryable model error is rethrown as-is (no retry storm)", async () => {
    let attempts = 0;
    const fatal = new ModelCallError("HTTP 403 FreeTierError", false, { status: 403 });
    let caught: unknown;
    try {
      await withRetry(async () => {
        attempts++;
        throw fatal;
      }, { retries: 4 });
    } catch (error) {
      caught = error;
    }
    assert(caught === fatal, "the original non-retryable error must propagate unchanged");
    assert(attempts === 1, `expected exactly 1 attempt, got ${attempts}`);
    assert(isRetryableError(caught) === false, "403/free-tier must be classified non-retryable");
    assert(isFatalModelError(caught) === true, "non-retryable model error must be fatal");
  });

  await test("retry: retryable model error is retried then wrapped with cause", async () => {
    let attempts = 0;
    const transient = new ModelCallError("HTTP 503", true, { status: 503 });
    let caught: unknown;
    try {
      await withRetry(async () => {
        attempts++;
        throw transient;
      }, { retries: 2, baseDelayMs: 1, maxDelayMs: 2 });
    } catch (error) {
      caught = error;
    }
    assert(attempts === 3, `expected 3 attempts (1 + 2 retries), got ${attempts}`);
    assert(caught instanceof RetryExhaustedError, "exhausted retryable error should raise RetryExhaustedError");
    assert((caught as RetryExhaustedError).cause === transient, "RetryExhaustedError must carry the original cause");
    assert(isRetryableError(caught) === false, "an already-exhausted retry must not be retried again");
    assert(isFatalModelError(caught) === false, "a transient error is not fatal");
  });

  await test("retry: agent logic errors remain retryable", async () => {
    assert(isRetryableError(new Error("bad JSON from model")) === true, "generic errors should retry");
  });
}

async function opencodeCliCases(): Promise<void> {
  await test("opencode-cli: parses text + token usage from the JSON event stream", () => {
    const stdout = [
      '{"type":"step_start","part":{"type":"step-start"}}',
      '{"type":"text","part":{"type":"text","text":"PONG"}}',
      '{"type":"step_finish","part":{"type":"step-finish","tokens":{"input":100,"output":5}}}',
    ].join("\n");
    const events = parseEvents(stdout);
    assert(events.text === "PONG", `expected PONG, got '${events.text}'`);
    assert(events.promptTokens === 100 && events.completionTokens === 5, "token usage should be summed from step_finish");
    assert(events.error === null, "no error expected");
  });

  await test("opencode-cli: an empty error event does not fabricate an error", () => {
    const events = parseEvents('{"type":"error","error":{}}');
    assert(events.error === null, `empty error event must be ignored, got '${events.error}'`);
  });

  await test("opencode-cli: a real error message is surfaced", () => {
    const events = parseEvents('{"type":"error","error":{"message":"model overloaded"}}');
    assert(events.error === "model overloaded", `expected message, got '${events.error}'`);
  });
}

async function checkpointCases(): Promise<void> {
  await test("checkpoint: serialize -> parse round-trips a frozen state", async () => {
    const root = await makeTempDir("ckpt");
    try {
      const store = new StateStore(
        createInitialState({ goal: "roundtrip", workspaceRoot: root, profile: blankProfile(), git: NO_GIT }),
      );
      const parsed = parseCheckpoint(serializeCheckpoint(store.get()));
      assert(parsed.version === CHECKPOINT_VERSION, "version not preserved");
      assert(parsed.state.goal === "roundtrip", "goal not preserved");
      assert(Object.isFrozen(parsed.state), "parsed state should be frozen");
    } finally {
      await rmrf(root);
    }
  });

  await test("checkpoint: write -> read persists to run.json", async () => {
    const root = await makeTempDir("ckpt");
    try {
      const store = new StateStore(
        createInitialState({ goal: "persist", workspaceRoot: root, profile: blankProfile(), git: NO_GIT }),
      );
      const file = await writeCheckpoint(root, store.get());
      assert(file === checkpointPath(root), "unexpected checkpoint path");
      const read = await readCheckpoint(root);
      assert(read !== null, "checkpoint should exist after write");
      assert(read?.state.goal === "persist", "goal not persisted");
    } finally {
      await rmrf(root);
    }
  });

  await test("checkpoint: read returns null when no checkpoint exists", async () => {
    const root = await makeTempDir("ckpt");
    try {
      assert((await readCheckpoint(root)) === null, "expected null for a missing checkpoint");
    } finally {
      await rmrf(root);
    }
  });

  await test("checkpoint: an unsupported version is rejected", () => {
    let threw = false;
    try {
      parseCheckpoint(JSON.stringify({ version: 999, state: {} }));
    } catch (error) {
      threw = error instanceof CheckpointError;
    }
    assert(threw, "expected CheckpointError for an unsupported version");
  });

  await test("checkpoint: Checkpointer.mark + flush persists the latest state", async () => {
    const root = await makeTempDir("ckpt");
    try {
      const checkpointer = new Checkpointer({ root, delayMs: 5 });
      const store = new StateStore(
        createInitialState({ goal: "autosave", workspaceRoot: root, profile: blankProfile(), git: NO_GIT }),
        { onTransition: (state) => checkpointer.mark(state) },
      );
      store.setPhase("planning", "planning:start", "decomposing goal");
      await checkpointer.flush();
      const read = await readCheckpoint(root);
      assert(read?.state.phase === "planning", `phase not checkpointed: ${read?.state.phase}`);
    } finally {
      await rmrf(root);
    }
  });
}

async function resumeCase(verbose: boolean): Promise<void> {
  const root = await makeTempDir("resume");
  try {
    await test("resume: skips completed tasks and re-runs only the rest", async () => {
      const toolbox = await SystemToolbox.create({ root });

      const seed = new StateStore(
        createInitialState({ goal: "Resume demo", workspaceRoot: root, profile: blankProfile(), git: NO_GIT }),
      );
      seed.setPlan({
        summary: "two tasks",
        tasks: [
          {
            id: "task-1",
            title: "already done",
            description: "no-op",
            files: [],
            commands: [],
            acceptance: [],
            dependsOn: [],
            status: "done",
            attempts: 1,
            lastError: null,
          },
          {
            id: "task-2",
            title: "remaining work",
            description: "create src/hello.ts and a test",
            files: ["src/hello.ts"],
            commands: [],
            acceptance: [],
            dependsOn: ["task-1"],
            status: "pending",
            attempts: 0,
            lastError: null,
          },
        ],
      });
      await writeCheckpoint(root, seed.get());

      const loaded = await readCheckpoint(root);
      assert(loaded !== null, "seed checkpoint missing");
      const store = new StateStore(loaded!.state);

      const client = new MockLLMClient([
        JSON.stringify({ thought: "write", tool: "write_file", args: { path: "src/hello.ts", content: "export const hello = (): string => 'hi';\n" } }),
        JSON.stringify({ thought: "builder done", final: { files: [{ path: "src/hello.ts", summary: "hello" }], notes: "" } }),
        JSON.stringify({ thought: "write test", tool: "write_file", args: { path: "tests/hello.test.ts", content: "console.log('ok');\n" } }),
        JSON.stringify({ thought: "tests done", final: { testFiles: [{ path: "tests/hello.test.ts", summary: "smoke" }], commands: ['node -e "process.exit(0)"'], notes: "" } }),
        JSON.stringify({ thought: "review", final: { approved: true, summary: "ok", findings: [] } }),
        JSON.stringify({ thought: "audit", final: { safe: true, summary: "ok", findings: [] } }),
      ]);

      const orchestrator = new Orchestrator({
        goal: store.get().goal,
        store,
        client,
        toolbox,
        routing: { ...AGENT_MODEL_ROUTING },
        maxSteps: 8,
        maxRetries: 2,
        maxDebugAttempts: 2,
        maxBuildCycles: 2,
        contextBudgetBytes: 32 * 1024,
        verbose,
      });
      await orchestrator.run();

      const state = store.get();
      assert(state.status === "succeeded", `run should succeed, got ${state.status}`);
      assert(state.tasks[0]!.status === "done", "task-1 should remain done");
      assert(state.tasks[0]!.attempts === 1, "task-1 must not be re-attempted on resume");
      assert(state.tasks[1]!.status === "done", `task-2 should be done, got ${state.tasks[1]!.status}`);
      assert(state.plan?.summary === "two tasks", "existing plan must be reused, not regenerated");
      assert(state.metrics.agentCalls === 6, `expected 6 agent calls (task-2 only, no planner), got ${state.metrics.agentCalls}`);
    });
  } finally {
    await rmrf(root);
  }
}

export async function runSelfTest(options: { verbose?: boolean } = {}): Promise<number> {
  const verbose = options.verbose ?? false;
  const started = Date.now();
  console.log("== opencode-zen-harness self-test ==\n");

  await sandboxCases();
  await gitignoreCases();
  await diffCases();
  await discoveryCases();
  await gitSafetyCases();
  await retryCases();
  await opencodeCliCases();
  await checkpointCases();
  await orchestrationCase(verbose);
  await resumeCase(verbose);

  let passed = 0;
  for (const result of results) {
    const mark = result.ok ? "PASS" : "FAIL";
    console.log(`  [${mark}] ${result.name}${result.ok ? "" : ` -> ${result.message}`}`);
    if (result.ok) passed++;
  }
  const failed = results.length - passed;
  console.log(`\n${passed}/${results.length} passed in ${Date.now() - started}ms${failed > 0 ? ` (${failed} FAILED)` : ""}\n`);
  return failed === 0 ? 0 : 1;
}

const invokedDirectly = process.argv[1] !== undefined && /selftest\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  const verbose = process.argv.includes("--verbose");
  runSelfTest({ verbose })
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
