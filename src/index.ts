#!/usr/bin/env node
/**
 * CLI entrypoint.
 *
 *   node src/index.ts --goal "Add a health endpoint" --workspace ./my-project
 *   node src/index.ts --demo           # offline self-test (no network)
 *   node src/index.ts --goal-file ./GOAL.md
 *
 * `--demo` runs the deterministic self-test suite and exits.
 */

import { readFileSync } from "node:fs";
import { loadDotEnv } from "./core/env.ts";
import { StateStore, createInitialState } from "./core/state.ts";
import { ModelCallError } from "./core/errors.ts";
import { createLLMClient, pingModel, resolveTransport } from "./llm/factory.ts";
import { SystemToolbox } from "./tools/toolbox.ts";
import { Orchestrator } from "./orchestration/orchestrator.ts";
import { resolveAgentRouting } from "./config/models.ts";
import type { ProjectProfile } from "./core/types.ts";
import { runSelfTest } from "./selftest.ts";

interface CliOptions {
  goal: string | null;
  goalFile: string | null;
  workspace: string | null;
  verbose: boolean;
  demo: boolean;
  ping: boolean;
  maxSteps: number | null;
  maxRetries: number | null;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = {
    goal: null,
    goalFile: null,
    workspace: null,
    verbose: false,
    demo: false,
    ping: false,
    maxSteps: null,
    maxRetries: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = (): string => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case "--goal":
      case "-g":
        opts.goal = next();
        break;
      case "--goal-file":
        opts.goalFile = next();
        break;
      case "--workspace":
      case "-w":
        opts.workspace = next();
        break;
      case "--verbose":
      case "-v":
        opts.verbose = true;
        break;
      case "--demo":
        opts.demo = true;
        break;
      case "--ping":
        opts.ping = true;
        break;
      case "--max-steps":
        opts.maxSteps = Number(next());
        break;
      case "--max-retries":
        opts.maxRetries = Number(next());
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(
    [
      "opencode-zen-harness",
      "",
      "Usage:",
      "  node src/index.ts --goal \"<goal>\" [--workspace <dir>] [--verbose]",
      "  node src/index.ts --goal-file <path> [--workspace <dir>]",
      "  node src/index.ts --demo",
      "",
      "Options:",
      "  -g, --goal <text>       The engineering goal to execute.",
      "      --goal-file <path>  Read the goal from a file.",
      "  -w, --workspace <dir>   Target workspace root (default: cwd).",
      "  -v, --verbose           Stream agent + boundary logs to the console.",
      "      --max-steps <n>     Max ReAct steps per agent (default: 12).",
      "      --max-retries <n>   Retries per agent boundary (default: 4).",
      "      --ping              Preflight each routed model and report auth/route status.",
      "      --demo              Run the offline self-test suite and exit.",
      "",
      "Environment:",
      "  HARNESS_TRANSPORT       'zen' (default, direct HTTP) or 'opencode-cli'.",
      "                          Use 'opencode-cli' to run the -free Zen models via",
      "                          the local OpenCode client (no API key needed).",
      "  OPENCODE_ZEN_API_KEY    Required for the 'zen' transport.",
      "  OPENCODE_ZEN_BASE_URL   Defaults to https://opencode.ai/zen/v1",
      "  HARNESS_MODEL_<ROLE>    Override a role's model, e.g. HARNESS_MODEL_PLANNER=glm-5.1",
      "                          Roles: ORCHESTRATOR, PLANNER, REPO_EXPLORER, BUILDER,",
      "                          TEST_ENGINEER, DEBUGGER, REVIEWER, SECURITY_AUDITOR, RELEASE.",
      "  HARNESS_MODEL           Global fallback model for any unset role.",
    ].join("\n"),
  );
}

function readGoal(opts: CliOptions): string | null {
  if (opts.goal) return opts.goal;
  if (opts.goalFile) {
    // Deliberately synchronous: goal resolution happens before any async work.
    const content = readFileSync(opts.goalFile, "utf8");
    return content.trim();
  }
  return null;
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  loadDotEnv();
  const opts = parseArgs(argv);

  if (opts.demo) {
    return await runSelfTest({ verbose: opts.verbose });
  }

  let client: ReturnType<typeof createLLMClient>;
  try {
    client = createLLMClient();
  } catch (error) {
    if (error instanceof ModelCallError) {
      console.error(`error: ${error.message}`);
      return 2;
    }
    throw error;
  }

  if (opts.ping) {
    const routing = resolveAgentRouting();
    const models = [...new Set(Object.values(routing))];
    console.log(`preflight: transport=${resolveTransport()} client=${client.id} (${models.length} distinct model(s))`);
    let allOk = true;
    for (const model of models) {
      const res = await pingModel(client, model);
      allOk = allOk && res.ok;
      console.log(`  ${res.ok ? "OK  " : "FAIL"} ${model} -> ${res.detail}`);
    }
    return allOk ? 0 : 1;
  }

  const goal = readGoal(opts);
  if (!goal) {
    printHelp();
    return 2;
  }

  const workspaceRoot = opts.workspace ?? process.env.HARNESS_WORKSPACE ?? process.cwd();
  const maxSteps = opts.maxSteps ?? Number(process.env.HARNESS_MAX_AGENT_STEPS ?? 12);
  const maxRetries = opts.maxRetries ?? Number(process.env.HARNESS_MAX_RETRIES ?? 4);

  const toolbox = await SystemToolbox.create({ root: workspaceRoot });
  const bootstrapProfile: ProjectProfile = {
    mode: "new",
    language: "unknown",
    packageManager: null,
    signatureFiles: [],
    commands: { install: null, build: null, test: null, lint: null, format: null, run: null },
    isGitRepo: false,
    notes: ["bootstrap placeholder until discovery runs"],
  };
  const store = new StateStore(
    createInitialState({
      goal,
      workspaceRoot: toolbox.root,
      profile: bootstrapProfile,
      git: { isRepo: false, branch: null, dirtyBefore: false, scratchBranch: null, createdScratch: false, baseCommit: null },
    }),
  );

  const orchestrator = new Orchestrator({
    goal,
    store,
    client,
    toolbox,
    routing: resolveAgentRouting(),
    maxSteps,
    maxRetries,
    maxDebugAttempts: 3,
    maxBuildCycles: 2,
    contextBudgetBytes: 96 * 1024,
    verbose: opts.verbose,
  });

  await orchestrator.run();
  return store.get().status === "succeeded" ? 0 : 1;
}

const invokedDirectly = process.argv[1] !== undefined && /index\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
