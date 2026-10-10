/**
 * SystemToolbox — the single capability surface every agent has for touching
 * the host workspace. It is language-agnostic: file I/O, unified-diff patching,
 * recursive listing, content search, and sandboxed subprocess execution.
 *
 * All filesystem access is confined to the workspace root by
 * {@link resolveInSandbox}; all subprocess calls run with the sandbox as cwd
 * and pass through a destructive-command guard.
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { SandboxViolation, ToolExecutionError } from "../core/errors.ts";
import { applyUnifiedDiff } from "./diff.ts";
import { buildIgnoreMatcher, normalizeRoot, resolveInSandbox, toRelative, type IgnoreMatcher } from "./sandbox.ts";

export interface ToolboxOptions {
  readonly root: string;
  readonly commandTimeoutMs?: number;
  readonly maxOutputBytes?: number;
  readonly ignore?: IgnoreMatcher;
}

export interface WriteResult {
  readonly path: string;
  readonly created: boolean;
  readonly bytes: number;
}

export interface PatchResult {
  readonly path: string;
  readonly before: string;
  readonly after: string;
  readonly unifiedDiff: string;
}

export interface SearchHit {
  readonly path: string;
  readonly line: number;
  readonly text: string;
}

export interface ExecResult {
  readonly command: string;
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
}

const DESTRUCTIVE_PATTERNS: readonly RegExp[] = [
  /\brm\s+(-[a-z]*\s+)*-?[a-z]*f[a-z]*\s+\/(?:\s|$)/i,
  /\brm\s+-rf\s+~\b/i,
  /\bmkfs(\.[a-z0-9]+)?\b/i,
  /\bdd\s+.*\bof=\/dev\//i,
  /:\(\)\s*\{\s*:\|:&\s*\};:/,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bformat\s+[a-z]:/i,
  /\bdel\s+\/[a-z]*\s*\/[a-z]*\s+\/[a-z]*\s+[a-z]:\\(?:\s|$)/i,
  /\bmkfs\b/i,
];

export class SystemToolbox {
  readonly root: string;
  readonly commandTimeoutMs: number;
  readonly maxOutputBytes: number;
  #ignore: IgnoreMatcher;

  constructor(options: ToolboxOptions) {
    this.root = normalizeRoot(options.root);
    this.commandTimeoutMs = options.commandTimeoutMs ?? 600_000;
    this.maxOutputBytes = options.maxOutputBytes ?? 2_000_000;
    this.#ignore = options.ignore ?? buildIgnoreMatcher(null);
  }

  static async create(options: ToolboxOptions): Promise<SystemToolbox> {
    const root = normalizeRoot(options.root);
    let gitignore: string | null = null;
    try {
      gitignore = await fs.readFile(path.join(root, ".gitignore"), "utf8");
    } catch {
      gitignore = null;
    }
    const ignore = options.ignore ?? buildIgnoreMatcher(gitignore);
    return new SystemToolbox({ ...options, root, ignore });
  }

  get ignore(): IgnoreMatcher {
    return this.#ignore;
  }

  /** Resolve a path against the sandbox, throwing on escape attempts. */
  resolve(target: string): string {
    return resolveInSandbox(this.root, target);
  }

  rel(target: string): string {
    return toRelative(this.root, this.resolve(target));
  }

  async exists(target: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(target));
      return true;
    } catch {
      return false;
    }
  }

  async isDirectory(target: string): Promise<boolean> {
    try {
      const stat = await fs.stat(this.resolve(target));
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async readFile(target: string, maxBytes = this.maxOutputBytes): Promise<string> {
    const abs = this.resolve(target);
    try {
      const stat = await fs.stat(abs);
      if (stat.size > maxBytes) {
        throw new ToolExecutionError(`file exceeds read budget (${stat.size} > ${maxBytes})`, { path: this.rel(target) });
      }
      return await fs.readFile(abs, "utf8");
    } catch (error) {
      if (error instanceof ToolExecutionError) throw error;
      throw new ToolExecutionError(`failed to read file: ${(error as Error).message}`, { path: this.rel(target) });
    }
  }

  async writeFile(target: string, content: string): Promise<WriteResult> {
    const abs = this.resolve(target);
    let created = true;
    try {
      await fs.access(abs);
      created = false;
    } catch {
      created = true;
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf8");
    return { path: this.rel(target), created, bytes: Buffer.byteLength(content, "utf8") };
  }

  /** Apply a unified diff to an existing file and persist the result. */
  async applyPatch(target: string, unifiedDiff: string): Promise<PatchResult> {
    const before = await this.readFile(target);
    let after: string;
    try {
      after = applyUnifiedDiff(before, unifiedDiff);
    } catch (error) {
      throw new ToolExecutionError(`patch failed: ${(error as Error).message}`, { path: this.rel(target) });
    }
    await this.writeFile(target, after);
    return { path: this.rel(target), before, after, unifiedDiff };
  }

  async deleteFile(target: string): Promise<string> {
    const abs = this.resolve(target);
    try {
      await fs.unlink(abs);
      return this.rel(target);
    } catch (error) {
      throw new ToolExecutionError(`failed to delete file: ${(error as Error).message}`, { path: this.rel(target) });
    }
  }

  /** Recursively list files, honoring the ignore matcher. Returns POSIX rel paths. */
  async listFiles(start = ".", options: { maxFiles?: number; maxDepth?: number } = {}): Promise<string[]> {
    const maxFiles = options.maxFiles ?? 5_000;
    const maxDepth = options.maxDepth ?? 24;
    const results: string[] = [];
    const startAbs = this.resolve(start);

    const walk = async (dirAbs: string, depth: number): Promise<void> => {
      if (depth > maxDepth || results.length >= maxFiles) return;
      let entries: import("node:fs").Dirent[];
      try {
        entries = await fs.readdir(dirAbs, { withFileTypes: true });
      } catch {
        return;
      }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (results.length >= maxFiles) return;
        const abs = path.join(dirAbs, entry.name);
        const rel = toRelative(this.root, abs);
        const isDir = entry.isDirectory();
        if (this.#ignore.ignores(rel, isDir)) continue;
        if (entry.isSymbolicLink()) continue;
        if (isDir) {
          await walk(abs, depth + 1);
        } else if (entry.isFile()) {
          results.push(rel);
        }
      }
    };

    await walk(startAbs, 0);
    return results;
  }

  /** Recursively search file contents for a pattern. */
  async search(
    pattern: string,
    options: { isRegex?: boolean; maxResults?: number; include?: (p: string) => boolean; flags?: string } = {},
  ): Promise<SearchHit[]> {
    const isRegex = options.isRegex ?? true;
    const maxResults = options.maxResults ?? 200;
    const re = new RegExp(isRegex ? pattern : escapeRegExp(pattern), options.flags ?? "i");
    const files = await this.listFiles(".");
    const hits: SearchHit[] = [];
    for (const file of files) {
      if (hits.length >= maxResults) break;
      if (options.include && !options.include(file)) continue;
      let content: string;
      try {
        content = await this.readFile(file, 512 * 1024);
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length && hits.length < maxResults; i++) {
        if (re.test(lines[i]!)) {
          hits.push({ path: file, line: i + 1, text: lines[i]!.slice(0, 400) });
        }
      }
    }
    return hits;
  }

  private guardCommand(command: string): void {
    for (const pattern of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(command)) {
        throw new SandboxViolation("command blocked by destructive-command guard", { command });
      }
    }
  }

  /** Execute a shell command inside the sandbox root. */
  async runCommand(
    command: string,
    options: { cwd?: string; timeoutMs?: number; env?: Record<string, string>; stdin?: string } = {},
  ): Promise<ExecResult> {
    this.guardCommand(command);
    const cwd = options.cwd ? this.resolve(options.cwd) : this.root;
    const timeoutMs = options.timeoutMs ?? this.commandTimeoutMs;
    const start = Date.now();

    return await new Promise<ExecResult>((resolvePromise, reject) => {
      const child = spawn(command, {
        cwd,
        shell: true,
        env: { ...process.env, ...options.env },
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;

      const finish = (code: number | null): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolvePromise({
          command,
          code,
          stdout: truncate(stdout, this.maxOutputBytes),
          stderr: truncate(stderr, this.maxOutputBytes),
          durationMs: Date.now() - start,
          timedOut,
        });
      };

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new ToolExecutionError(`command failed to spawn: ${error.message}`, { command }));
      });
      child.on("close", (code) => finish(code));

      if (options.stdin !== undefined) {
        child.stdin?.write(options.stdin);
        child.stdin?.end();
      }
    });
  }

  async git(args: string): Promise<ExecResult> {
    return await this.runCommand(`git ${args}`);
  }

  /** Repository status parsed from porcelain output. */
  async gitStatus(): Promise<{ isRepo: boolean; branch: string | null; dirty: boolean; files: string[] }> {
    try {
      const result = await this.runCommand("git status --porcelain=v1 -b");
      if (result.code !== 0) return { isRepo: false, branch: null, dirty: false, files: [] };
      const lines = result.stdout.split(/\r?\n/).filter((l) => l.length > 0);
      const branchLine = lines.find((l) => l.startsWith("##"));
      const branch = branchLine ? parseBranch(branchLine) : null;
      const files = lines.filter((l) => !l.startsWith("##"));
      return { isRepo: true, branch, dirty: files.length > 0, files };
    } catch {
      return { isRepo: false, branch: null, dirty: false, files: [] };
    }
  }

  async currentCommit(): Promise<string | null> {
    const result = await this.runCommand("git rev-parse HEAD");
    if (result.code !== 0) return null;
    return result.stdout.trim() || null;
  }

  async readGitignore(): Promise<string | null> {
    try {
      return await fs.readFile(path.join(this.root, ".gitignore"), "utf8");
    } catch {
      return null;
    }
  }
}

function parseBranch(line: string): string | null {
  const body = line.slice(2).trim();
  if (body.startsWith("No commits yet on ")) return body.replace("No commits yet on ", "");
  const name = body.split("...")[0];
  return name && name.length > 0 ? name : null;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncate(text: string, max: number): string {
  if (Buffer.byteLength(text, "utf8") <= max) return text;
  return `${text.slice(0, max)}\n...[truncated ${Buffer.byteLength(text, "utf8") - max} bytes]`;
}
