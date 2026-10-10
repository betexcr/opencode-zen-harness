/**
 * Sandbox path resolution and `.gitignore`-aware filtering.
 *
 * Every filesystem operation performed by a {@link SystemToolbox} is first
 * funnelled through {@link resolveInSandbox}, which hard-locks resolution to
 * the workspace root. Any attempt to escape (via `..`, absolute paths, drive
 * changes, or symlink-style tricks) raises a {@link SandboxViolation}.
 */

import * as path from "node:path";
import { SandboxViolation } from "../core/errors.ts";

export function normalizeRoot(root: string): string {
  const abs = path.resolve(root);
  // Strip a trailing separator except on a filesystem root.
  const parsed = path.parse(abs);
  if (abs.length > parsed.root.length && abs.endsWith(path.sep)) {
    return abs.slice(0, -1);
  }
  return abs;
}

function isInside(root: string, candidate: string): boolean {
  if (candidate === root) return true;
  return candidate.startsWith(root + path.sep);
}

/**
 * Resolve `target` (absolute or relative) against the sandbox `root` and prove
 * it stays inside the root. Returns the normalized absolute path.
 */
export function resolveInSandbox(root: string, target: string): string {
  if (typeof target !== "string" || target.length === 0) {
    throw new SandboxViolation("empty path is not allowed", { target });
  }
  if (target.includes("\0")) {
    throw new SandboxViolation("null byte in path", { target });
  }
  const base = normalizeRoot(root);
  const resolved = path.resolve(base, target);
  if (!isInside(base, resolved)) {
    throw new SandboxViolation("path escapes the sandbox root", { root: base, target, resolved });
  }
  return resolved;
}

/** Convert a normalized absolute path back into a POSIX-style relative path. */
export function toRelative(root: string, absolute: string): string {
  const rel = path.relative(normalizeRoot(root), absolute);
  return rel.split(path.sep).join("/");
}

export interface IgnoreMatcher {
  readonly patterns: readonly string[];
  ignores(relPath: string, isDir: boolean): boolean;
}

/**
 * Directories that are always excluded from listing/context regardless of the
 * presence of a `.gitignore`, to protect token budget and avoid scanning
 * dependency trees or VCS internals.
 */
export const DEFAULT_IGNORE_DIRS: readonly string[] = [
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "env",
  ".env",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  "dist",
  "build",
  "out",
  "target",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  "coverage",
  ".idea",
  ".vscode",
  "vendor",
  "bin",
  "obj",
  ".gradle",
  ".harness-scratch",
];

function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!;
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        // `**` matches across directory boundaries.
        const next = glob[i + 2];
        if (next === "/") {
          out += "(?:.*/)?";
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else {
        out += "[^/]*";
      }
    } else if (ch === "?") {
      out += "[^/]";
    } else if ("+()^$.{}[]|\\".includes(ch)) {
      out += "\\" + ch;
    } else {
      out += ch;
    }
  }
  return new RegExp(`^${out}$`);
}

interface CompiledRule {
  readonly negated: boolean;
  readonly dirOnly: boolean;
  readonly regex: RegExp;
}

function compileRule(rawPattern: string): CompiledRule | null {
  let pattern = rawPattern;
  let negated = false;
  if (pattern.startsWith("!")) {
    negated = true;
    pattern = pattern.slice(1);
  }
  if (pattern.startsWith("\\#") || pattern.startsWith("\\!")) {
    pattern = pattern.slice(1);
  }
  if (pattern.length === 0) return null;

  const dirOnly = pattern.endsWith("/");
  if (dirOnly) pattern = pattern.replace(/\/+$/, "");

  const anchored = pattern.startsWith("/");
  if (anchored) pattern = pattern.slice(1);
  if (pattern.length === 0) return null;

  const hasSlash = pattern.includes("/");
  const body = globToRegExp(pattern);
  // Unanchored, slash-free patterns match at any depth.
  const source = anchored || hasSlash ? body.source : `(?:.*/)?${body.source.slice(1, -1)}$`;
  const regex = anchored || hasSlash ? body : new RegExp(`^${source}`);
  return { negated, dirOnly, regex };
}

export function compileGitignore(content: string): IgnoreMatcher {
  const patterns: string[] = [];
  const rules: CompiledRule[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    patterns.push(line);
    const rule = compileRule(line);
    if (rule) rules.push(rule);
  }

  const ignores = (relPath: string, isDir: boolean): boolean => {
    const normalized = relPath.replace(/\\/g, "/").replace(/^\.\//, "");
    if (normalized.length === 0) return false;
    let ignored = false;
    for (const rule of rules) {
      if (rule.dirOnly && !isDir) continue;
      if (rule.regex.test(normalized)) {
        ignored = !rule.negated;
      }
    }
    return ignored;
  };

  return { patterns, ignores };
}

/** Build the effective matcher: default directory excludes + user gitignore. */
export function buildIgnoreMatcher(gitignoreContent: string | null): IgnoreMatcher {
  const defaults = compileGitignore(DEFAULT_IGNORE_DIRS.map((d) => `${d}/`).join("\n"));
  const user = gitignoreContent ? compileGitignore(gitignoreContent) : compileGitignore("");
  const patterns = [...new Set([...defaults.patterns, ...user.patterns])];
  return {
    patterns,
    ignores(relPath: string, isDir: boolean): boolean {
      const rel = relPath.replace(/\\/g, "/");
      const segments = rel.split("/");
      for (const seg of segments) {
        if (DEFAULT_IGNORE_DIRS.includes(seg)) return true;
      }
      if (defaults.ignores(rel, isDir)) return true;
      return user.ignores(rel, isDir);
    },
  };
}
