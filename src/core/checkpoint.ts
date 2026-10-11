/**
 * Durable checkpointing.
 *
 * `HarnessState` lives entirely in memory, so an abrupt crash (OOM, Ctrl-C,
 * power loss) would otherwise lose the whole run. This module snapshots the
 * frozen state to `<workspace>/.harness-scratch/run.json` on every transition
 * so a run can be resumed with `--resume`.
 *
 * `.harness-scratch/` is already excluded from discovery/listing (see
 * `DEFAULT_IGNORE_DIRS`) and from git, so the snapshot never pollutes a
 * workspace or the token budget.
 *
 * Writes are atomic (temp file + rename) and debounced by {@link Checkpointer}
 * to bound I/O on the hot transition path; {@link Checkpointer.flush} forces a
 * final save at the end of a run.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { HarnessError } from "./errors.ts";
import { deepFreeze, type HarnessState } from "./state.ts";

export const CHECKPOINT_VERSION = 1;
export const CHECKPOINT_DIR = ".harness-scratch";
export const CHECKPOINT_FILE = "run.json";

export interface Checkpoint {
  readonly version: number;
  readonly savedAt: string;
  readonly state: HarnessState;
}

export class CheckpointError extends HarnessError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("CHECKPOINT", message, details);
  }
}

export function checkpointPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, CHECKPOINT_DIR, CHECKPOINT_FILE);
}

export function serializeCheckpoint(state: HarnessState): string {
  const record: Checkpoint = { version: CHECKPOINT_VERSION, savedAt: new Date().toISOString(), state };
  return JSON.stringify(record, null, 2);
}

export function parseCheckpoint(text: string): Checkpoint {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new CheckpointError(`checkpoint is not valid JSON: ${(error as Error).message}`);
  }
  const record = parsed as Partial<Checkpoint>;
  if (!record || typeof record !== "object" || typeof record.state !== "object" || record.state === null) {
    throw new CheckpointError("checkpoint is missing the `state` object");
  }
  if (record.version !== CHECKPOINT_VERSION) {
    throw new CheckpointError(`unsupported checkpoint version ${String(record.version)} (expected ${CHECKPOINT_VERSION})`);
  }
  return {
    version: CHECKPOINT_VERSION,
    savedAt: typeof record.savedAt === "string" ? record.savedAt : new Date().toISOString(),
    state: deepFreeze(record.state as HarnessState),
  };
}

/** Atomically persist a state snapshot. Safe to call repeatedly. */
export async function writeCheckpoint(workspaceRoot: string, state: HarnessState): Promise<string> {
  const file = checkpointPath(workspaceRoot);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, serializeCheckpoint(state), "utf8");
  await fs.rename(tmp, file);
  return file;
}

/** Read a checkpoint, or return null if none exists. Throws on a corrupt file. */
export async function readCheckpoint(workspaceRoot: string): Promise<Checkpoint | null> {
  const file = checkpointPath(workspaceRoot);
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new CheckpointError(`failed to read checkpoint: ${(error as Error).message}`, { file });
  }
  return parseCheckpoint(text);
}

export async function clearCheckpoint(workspaceRoot: string): Promise<void> {
  try {
    await fs.rm(checkpointPath(workspaceRoot), { force: true });
  } catch {
    /* best effort */
  }
}

export interface CheckpointerOptions {
  readonly root: string;
  readonly delayMs?: number;
  readonly onError?: (error: unknown) => void;
}

/**
 * Debounced, write-behind snapshotter. `mark()` is cheap (cancels/replaces a
 * pending save); the actual disk write happens off the hot path. Call
 * `flush()` once at the end of a run to guarantee the final state is persisted.
 */
export class Checkpointer {
  readonly #root: string;
  readonly #delayMs: number;
  readonly #onError: ((error: unknown) => void) | undefined;
  #pending: HarnessState | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #writing = false;

  constructor(options: CheckpointerOptions) {
    this.#root = options.root;
    this.#delayMs = options.delayMs ?? 250;
    this.#onError = options.onError;
  }

  mark(state: HarnessState): void {
    this.#pending = state;
    if (this.#timer) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#drain();
    }, this.#delayMs);
    this.#timer.unref?.();
  }

  /** Force any pending snapshot to disk and wait for it to complete. */
  async flush(): Promise<void> {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    await this.#drain();
  }

  async #drain(): Promise<void> {
    if (this.#writing) return;
    this.#writing = true;
    try {
      while (this.#pending) {
        const state = this.#pending;
        this.#pending = null;
        try {
          await writeCheckpoint(this.#root, state);
        } catch (error) {
          this.#onError?.(error);
        }
      }
    } finally {
      this.#writing = false;
    }
  }
}
