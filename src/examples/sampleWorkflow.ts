/**
 * Sample end-to-end execution routine.
 *
 * Traces a project workflow from task inception to verified code: it wires the
 * full agent topology, runs the orchestrator against a workspace, then prints
 * the immutable run history, the file diffs, and the verification metrics.
 *
 * Run directly:
 *   node src/examples/sampleWorkflow.ts --workspace ./sandbox --goal "Create a CLI that greets the user"
 * (requires OPENCODE_ZEN_API_KEY; the key is only needed for this live path).
 */

import { loadDotEnv } from "../core/env.ts";
import { StateStore, createInitialState } from "../core/state.ts";
import { createLLMClient } from "../llm/factory.ts";
import { SystemToolbox } from "../tools/toolbox.ts";
import { Orchestrator } from "../orchestration/orchestrator.ts";
import { resolveAgentRouting } from "../config/models.ts";
import { discoverProfile } from "../discovery/discovery.ts";
import type { HarnessState } from "../core/state.ts";

export async function runSampleWorkflow(workspaceRoot: string, goal: string, verbose = true): Promise<HarnessState> {
  loadDotEnv();

  // 1) Sandbox the workspace.
  const toolbox = await SystemToolbox.create({ root: workspaceRoot });

  // 2) Bootstrap state with a provisional profile (discovery refines it).
  const bootstrap = await discoverProfile(toolbox);
  const store = new StateStore(
    createInitialState({
      goal,
      workspaceRoot: toolbox.root,
      profile: bootstrap.profile,
      git: { isRepo: false, branch: null, dirtyBefore: false, scratchBranch: null, createdScratch: false, baseCommit: null },
    }),
  );

  // 3) Route agent payloads through the selected transport (Zen HTTP or the
  //    local `opencode run` CLI).
  const client = createLLMClient();

  // 4) Drive the state machine.
  const orchestrator = new Orchestrator({
    goal,
    store,
    client,
    toolbox,
    routing: resolveAgentRouting(),
    maxSteps: Number(process.env.HARNESS_MAX_AGENT_STEPS ?? 12),
    maxRetries: Number(process.env.HARNESS_MAX_RETRIES ?? 4),
    maxDebugAttempts: 3,
    maxBuildCycles: 2,
    contextBudgetBytes: 96 * 1024,
    verbose,
  });
  await orchestrator.run();

  const state = store.get();
  printTrace(state);
  return state;
}

export function printTrace(state: HarnessState): void {
  const line = "=".repeat(72);
  console.log(`\n${line}\nRUN ${state.runId}  status=${state.status}  phase=${state.phase}\n${line}`);
  console.log(`goal: ${state.goal}`);
  console.log(`workspace: ${state.workspaceRoot}`);
  console.log(`detected: mode=${state.profile.mode} language=${state.profile.language} pm=${state.profile.packageManager ?? "-"}`);
  console.log(`git: repo=${state.git.isRepo} branch=${state.git.branch ?? "-"} scratch=${state.git.scratchBranch ?? "-"}`);

  console.log(`\n-- TASKS (${state.tasks.length}) --`);
  for (const task of state.tasks) {
    console.log(`  [${task.status}] ${task.id}: ${task.title} (attempts=${task.attempts})`);
  }

  console.log(`\n-- FILE DIFFS (${state.diffs.length}) --`);
  for (const diff of state.diffs) {
    const added = diff.unifiedDiff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
    const removed = diff.unifiedDiff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
    console.log(`  ${diff.action.padEnd(6)} ${diff.path}  (+${added}/-${removed})  task=${diff.taskId ?? "-"}`);
  }

  console.log(`\n-- VERIFICATION --`);
  for (const run of state.testRuns) {
    console.log(`  ${run.ok ? "PASS" : "FAIL"} ${run.stage} :: ${run.command} (exit ${run.exitCode ?? "-"})`);
  }

  console.log(`\n-- TIMELINE (${state.history.length} transitions) --`);
  for (const entry of state.history) {
    console.log(`  ${entry.ts}  [${entry.phase}] ${entry.event}${entry.note ? ` - ${entry.note}` : ""}`);
  }

  console.log(`\n-- METRICS --`);
  console.log(`  ${JSON.stringify(state.metrics, null, 2).split("\n").join("\n  ")}`);
  console.log(`${line}\n`);
}

const invokedDirectly = process.argv[1] !== undefined && /sampleWorkflow\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const get = (flag: string): string | null => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1]! : null;
  };
  const workspace = get("--workspace") ?? process.cwd();
  const goal = get("--goal") ?? "Bootstrap a minimal, tested project in this workspace.";
  runSampleWorkflow(workspace, goal, true)
    .then((state) => process.exit(state.status === "succeeded" ? 0 : 1))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
