# opencode-zen-harness

A dynamic, production-ready multi-agent harness for **autonomous software engineering**. It plans, builds, tests, debugs, reviews, security-audits, and releases work — for brand-new projects and existing/legacy codebases alike — coordinating nine specialised agent roles routed across OpenCode Zen models.

- **Immutable state machine.** Every mutation is recorded against a frozen `HarnessState`; phases, tasks, diffs, reviews, security findings, and metrics are all auditable.
- **Model-agnostic.** Agents speak a single JSON-per-turn wire protocol, so any chat model works — no reliance on native function calling.
- **Sandboxed by default.** All file and shell access is confined to the workspace root, with a destructive-command guard and a git safety lock.
- **Dependency-free runtime.** Pure TypeScript ESM; Node runs `.ts` directly (type-stripping). No build step, no runtime dependencies.

---

## Requirements

- **Node.js >= 22.6** (developed on Node 24; `.ts` files are executed via native type-stripping).
- **git** on `PATH` (optional, but enables the safety lock and release commits).
- One of the two transports below.

---

## Quick start

```powershell
npm install          # dev-only deps (typescript, @types/node)

# 1. Offline: prove the whole topology works, no network or keys
node src/index.ts --demo

# 2. Health-check every routed model over the selected transport
node src/index.ts --ping

# 3. Live run against a workspace
node src/index.ts --goal "Add a /health endpoint with a test" --workspace . --verbose
```

---

## Transports (and the free-tier gate)

The harness can reach Zen models two ways. Select with `HARNESS_TRANSPORT`.

| Transport | Value | Needs | Notes |
|---|---|---|---|
| **zen** (default) | `zen` | `OPENCODE_ZEN_API_KEY` | Direct HTTP to `https://opencode.ai/zen/v1/chat/completions`. The `*-free` models return **HTTP 403** here — the Zen free tier is only served *inside the OpenCode client*. Use a funded account with an `openai-compatible` model, or any other OpenAI-compatible endpoint. |
| **opencode-cli** | `opencode-cli` | the local `opencode` CLI | Routes each call through `opencode run`, reusing the OpenCode client's own auth. The `*-free` models work as-is with **no API key**. Slower (one CLI process per agent turn). |

```powershell
# Run the free Zen models locally, no API key required
$env:HARNESS_TRANSPORT = "opencode-cli"
node src/index.ts --goal "Create a CLI that greets the user" --workspace . --verbose
```

Point the direct transport at any OpenAI-compatible backend:

```powershell
$env:OPENCODE_ZEN_BASE_URL = "http://localhost:11434/v1"   # e.g. Ollama
$env:OPENCODE_ZEN_API_KEY  = "ollama"
$env:HARNESS_MODEL         = "qwen2.5-coder"
```

---

## Agent topology

Each role is bound to a model chosen for its strengths. Overrides are available (see [Configuration](#configuration)).

| Role | Default model | Responsibility |
|---|---|---|
| `orchestrator` | `step-5-preview-free` | Owns the state machine and routes work; adjudicates rebuilds. |
| `planner` | `big-pickle` | Decomposes the goal into a dependency-ordered task plan. |
| `repo-explorer` | `longcat-2.5-preview-free` | Indexes an existing codebase into a structural map. |
| `builder` | `step-5-preview-free` | Writes/patches code to satisfy a task. |
| `test-engineer` | `nemotron-3-ultra-free` | Authors tests and emits verification commands. |
| `debugger` | `big-pickle` | Diagnoses failing test runs and patches the cause. |
| `reviewer` | `big-pickle` | Reviews the diff against the goal and acceptance criteria. |
| `security-auditor` | `big-pickle` | Audits changes for injection, secrets, and unsafe defaults. |
| `release` | `mimo-v2.6-flash-free` | Runs lint/build/test stages and performs the gated commit. |

### Lifecycle

```
discovery -> planning -> exploring -> [ per task: building -> testing -> debugging ->
reviewing -> security ] -> releasing -> done
```

Discovery classifies the workspace as **new** or **existing**, detects the language/toolchain, and cuts a scratch git branch if the tree is dirty. Existing projects are indexed before work begins; every task is only marked `done` once tests pass and review + security approve.

---

## Tools available to agents

Agents call tools through a strict, sandboxed toolbox: `read_file`, `write_file`, `apply_patch` (unified diff with fuzzy-context tolerance), `delete_file`, `list_files` (ignore-aware), `search_files`, and `run_command` (destructive-command guard).

---

## Safety

- **Path sandbox** — reads/writes are resolved and rejected if they escape the workspace root.
- **Destructive-command guard** — blocks `rm -rf /`, and similar footguns in `run_command`.
- **Git safety lock** — a dirty working tree triggers an isolated scratch branch instead of committing onto it.
- **Bounded retries** — a single classification source decides what is retryable; auth/transport failures are never retried and abort the run cleanly, while transient failures back off and retry.

---

## Configuration

All configuration is environment-based (a local `.env` is loaded automatically — copy `.env.example`).

| Variable | Default | Purpose |
|---|---|---|
| `HARNESS_TRANSPORT` | `zen` | `zen` or `opencode-cli`. |
| `OPENCODE_ZEN_API_KEY` | — | Required for the `zen` transport (`OPENCODE_API_KEY` also accepted). |
| `OPENCODE_ZEN_BASE_URL` | `https://opencode.ai/zen/v1` | Direct transport base URL. |
| `HARNESS_WORKSPACE` | cwd | Default workspace root. |
| `HARNESS_MODEL_<ROLE>` | per-role default | Override a single role's model, e.g. `HARNESS_MODEL_PLANNER=glm-5.3`. |
| `HARNESS_MODEL` | — | Global fallback model for any unset role. |
| `HARNESS_MAX_AGENT_STEPS` | `12` | Max ReAct steps per agent invocation. |
| `HARNESS_MAX_RETRIES` | `4` | Retries per agent boundary. |

**opencode-cli transport:**

| Variable | Default | Purpose |
|---|---|---|
| `HARNESS_OPENCODE_BIN` | `opencode` | Path to the CLI binary. |
| `HARNESS_OPENCODE_PROVIDER` | `opencode` | Provider prefix (`opencode/big-pickle`). |
| `HARNESS_OPENCODE_TIMEOUT_MS` | `180000` | Per-call timeout. |
| `HARNESS_OPENCODE_PURE` | `false` | `1`/`true` runs the CLI with `--pure` (no external plugins). |

Role names for overrides: `ORCHESTRATOR`, `PLANNER`, `REPO_EXPLORER`, `BUILDER`, `TEST_ENGINEER`, `DEBUGGER`, `REVIEWER`, `SECURITY_AUDITOR`, `RELEASE`.

---

## CLI reference

```
node src/index.ts --goal "<goal>" [--workspace <dir>] [--verbose]
node src/index.ts --goal-file <path> [--workspace <dir>]
node src/index.ts --ping
node src/index.ts --demo
```

| Flag | Description |
|---|---|
| `-g`, `--goal <text>` | The engineering goal to execute. |
| `--goal-file <path>` | Read the goal from a file. |
| `-w`, `--workspace <dir>` | Target workspace root (default: cwd). |
| `-v`, `--verbose` | Stream agent and boundary logs. |
| `--max-steps <n>` | Max ReAct steps per agent. |
| `--max-retries <n>` | Retries per agent boundary. |
| `--ping` | Preflight each routed model; reports auth/route status. |
| `--demo` | Run the offline self-test suite and exit. |
| `-h`, `--help` | Show help. |

---

## Programmatic use

```ts
import { runSampleWorkflow } from "./src/examples/sampleWorkflow.ts";

const state = await runSampleWorkflow("./my-project", "Add a /health endpoint", true);
console.log(state.status, state.metrics);
```

---

## Project layout

```
src/
  index.ts                    CLI entrypoint (arg parsing, transport selection, ping)
  selftest.ts                 Hermetic test suite (no network)
  config/models.ts            Model registry, role routing, generation params
  core/
    state.ts                  Immutable HarnessState + StateStore
    types.ts                  Shared domain types
    errors.ts                 Error taxonomy, retry classification, Result
    env.ts                    .env loader
  llm/
    client.ts                 Zen HTTP client + MockLLMClient
    opencodeCliClient.ts      opencode CLI bridge transport
    factory.ts                Transport selection + ping
  tools/
    toolbox.ts                Sandboxed SystemToolbox (files + commands)
    sandbox.ts                Path sandbox + gitignore matcher
    diff.ts                   Unified diff parse/apply/create
  discovery/discovery.ts      Project detection + git safety lock
  agents/
    base.ts                   ReAct loop, wire protocol, tool dispatch
    planner.ts repoExplorer.ts builder.ts testEngineer.ts debugger.ts
    reviewer.ts securityAuditor.ts release.ts
  orchestration/orchestrator.ts   State-machine controller + routing decisions
  examples/sampleWorkflow.ts  End-to-end sample + trace printer
```

---

## Development

```powershell
npm run typecheck    # tsc --noEmit
npm run selftest     # node src/selftest.ts  (offline, deterministic)
npm run demo         # alias for --demo
```

The self-test runs entirely offline against a `MockLLMClient` and covers the sandbox, ignore matcher, diff engine, discovery, the git safety lock, retry classification, the CLI bridge parser, and a full multi-agent loop.

---

## Notes and limitations

- With the `opencode-cli` transport each agent turn spawns a process, so full runs are slow; this is inherent to using the free tier.
- The direct `zen` transport with the default `-free` models will fail with HTTP 403 unless routed via the OpenCode client — override the models or the base URL first.
- Long agent transcripts over the CLI transport re-send the flattened conversation each turn; keep `HARNESS_MAX_AGENT_STEPS` modest for large repos.
