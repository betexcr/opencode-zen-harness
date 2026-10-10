/**
 * Unified diff engine: parse, apply (fzf-style fuzzy offset matching), and
 * generate unified diffs. Self-contained so the harness has zero runtime
 * dependencies for patching source files.
 */

import { HarnessError } from "../core/errors.ts";

export type HunkLineType = "context" | "add" | "del";
export interface HunkLine {
  readonly type: HunkLineType;
  readonly text: string;
}
export interface Hunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly lines: readonly HunkLine[];
}
export interface FilePatch {
  readonly oldPath: string;
  readonly newPath: string;
  readonly hunks: readonly Hunk[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseUnifiedDiff(diffText: string): FilePatch[] {
  // The final newline terminates the last diff line; it is not an empty
  // context line. Strip exactly one trailing newline before splitting.
  const normalized = diffText.replace(/\r?\n$/, "");
  const rawLines = normalized.split(/\r?\n/);
  const patches: FilePatch[] = [];
  let current: { oldPath: string; newPath: string; hunks: Hunk[] } | null = null;
  let hunk: {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: HunkLine[];
  } | null = null;

  const flushHunk = (): void => {
    if (current && hunk) {
      current.hunks.push({ ...hunk, lines: [...hunk.lines] });
      hunk = null;
    }
  };
  const flushFile = (): void => {
    flushHunk();
    if (current) {
      patches.push({ oldPath: current.oldPath, newPath: current.newPath, hunks: current.hunks });
      current = null;
    }
  };

  for (const line of rawLines) {
    if (line.startsWith("diff --git")) {
      flushFile();
      continue;
    }
    if (line.startsWith("--- ")) {
      flushFile();
      const p = line.slice(4).trim();
      current = { oldPath: stripPrefix(p), newPath: "", hunks: [] };
      continue;
    }
    if (line.startsWith("+++ ")) {
      const p = line.slice(4).trim();
      if (!current) current = { oldPath: p, newPath: "", hunks: [] };
      current.newPath = stripPrefix(p);
      continue;
    }
    const header = HUNK_HEADER.exec(line);
    if (header) {
      flushHunk();
      if (!current) current = { oldPath: "", newPath: "", hunks: [] };
      hunk = {
        oldStart: Number(header[1]),
        oldLines: header[2] === undefined ? 1 : Number(header[2]),
        newStart: Number(header[3]),
        newLines: header[4] === undefined ? 1 : Number(header[4]),
        lines: [],
      };
      continue;
    }
    if (hunk) {
      if (line.startsWith("\\")) continue; // "\ No newline at end of file"
      if (line.startsWith("+")) {
        hunk.lines.push({ type: "add", text: line.slice(1) });
      } else if (line.startsWith("-")) {
        hunk.lines.push({ type: "del", text: line.slice(1) });
      } else if (line.startsWith(" ") || line === "") {
        hunk.lines.push({ type: "context", text: line.startsWith(" ") ? line.slice(1) : line });
      } else if (line.startsWith("@@")) {
        // malformed; ignore
      } else {
        // Tolerate lines that lost their leading space.
        hunk.lines.push({ type: "context", text: line });
      }
    }
  }
  flushFile();
  return patches.filter((p) => p.hunks.length > 0);
}

function stripPrefix(p: string): string {
  const cleaned = p.replace(/\t.*$/, "").trim();
  if (cleaned === "/dev/null") return cleaned;
  return cleaned.replace(/^[ab]\//, "");
}

interface SplitContent {
  readonly lines: string[];
  readonly trailingNewline: boolean;
}

function splitContent(content: string): SplitContent {
  const parts = content.split("\n");
  const trailingNewline = parts.length > 1 && parts[parts.length - 1] === "";
  if (trailingNewline) parts.pop();
  return { lines: parts, trailingNewline };
}

function joinContent(parts: SplitContent): string {
  const body = parts.lines.join("\n");
  return parts.trailingNewline ? `${body}\n` : body;
}

function findBlock(lines: readonly string[], block: readonly string[], expected: number): number {
  if (block.length === 0) return Math.min(expected, lines.length);
  const starts: number[] = [];
  const clamped = Math.max(0, Math.min(expected, lines.length - block.length));
  starts.push(clamped);
  for (let delta = 1; delta <= lines.length; delta++) {
    if (clamped - delta >= 0) starts.push(clamped - delta);
    if (clamped + delta <= lines.length - block.length) starts.push(clamped + delta);
  }
  for (const start of starts) {
    let match = true;
    for (let i = 0; i < block.length; i++) {
      if (lines[start + i] !== block[i]) {
        match = false;
        break;
      }
    }
    if (match) return start;
  }
  return -1;
}

export function applyFilePatch(content: string, patch: FilePatch): string {
  const { lines } = splitContent(content);
  const result = [...lines];
  let cumulativeDelta = 0;

  for (const hunk of patch.hunks) {
    const oldBlock = hunk.lines.filter((l) => l.type !== "add").map((l) => l.text);
    const newBlock = hunk.lines.filter((l) => l.type !== "del").map((l) => l.text);
    const expected = Math.max(0, hunk.oldStart - 1 + cumulativeDelta);
    const index = findBlock(result, oldBlock, expected);
    if (index === -1) {
      throw new HarnessError("PATCH_CONTEXT", "hunk context did not match the target file", {
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        block: oldBlock.slice(0, 4),
      });
    }
    result.splice(index, oldBlock.length, ...newBlock);
    cumulativeDelta += newBlock.length - oldBlock.length;
  }

  return joinContent({ lines: result, trailingNewline: true });
}

export function applyUnifiedDiff(content: string, diffText: string): string {
  const patches = parseUnifiedDiff(diffText);
  let out = content;
  for (const patch of patches) {
    out = applyFilePatch(out, patch);
  }
  return out;
}

interface Edit {
  readonly type: "eq" | "del" | "add";
  readonly text: string;
}

const MAX_LCS_LINES = 1_500;

function editScript(a: readonly string[], b: readonly string[]): Edit[] {
  if (a.length > MAX_LCS_LINES || b.length > MAX_LCS_LINES) {
    const edits: Edit[] = [];
    for (const line of a) edits.push({ type: "del", text: line });
    for (const line of b) edits.push({ type: "add", text: line });
    return edits;
  }
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const edits: Edit[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      edits.push({ type: "eq", text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      edits.push({ type: "del", text: a[i]! });
      i++;
    } else {
      edits.push({ type: "add", text: b[j]! });
      j++;
    }
  }
  while (i < n) edits.push({ type: "del", text: a[i++]! });
  while (j < m) edits.push({ type: "add", text: b[j++]! });
  return edits;
}

export function createUnifiedDiff(
  oldPath: string,
  newPath: string,
  oldContent: string,
  newContent: string,
  context = 3,
): string {
  const a = splitContent(oldContent).lines;
  const b = splitContent(newContent).lines;
  const edits = editScript(a, b);

  // Attach real old/new line numbers so hunk headers are accurate.
  const numbered: { type: Edit["type"]; text: string; oldNo: number | null; newNo: number | null }[] = [];
  let o = 1;
  let nn = 1;
  for (const e of edits) {
    numbered.push({
      type: e.type,
      text: e.text,
      oldNo: e.type === "add" ? null : o,
      newNo: e.type === "del" ? null : nn,
    });
    if (e.type !== "add") o++;
    if (e.type !== "del") nn++;
  }

  const changedIdx: number[] = [];
  numbered.forEach((line, idx) => {
    if (line.type !== "eq") changedIdx.push(idx);
  });
  if (changedIdx.length === 0) return "";

  const hunks: { start: number; end: number }[] = [];
  let start = changedIdx[0]!;
  let end = changedIdx[0]!;
  for (const idx of changedIdx.slice(1)) {
    if (idx - end <= context * 2 + 1) {
      end = idx;
    } else {
      hunks.push({ start, end });
      start = idx;
      end = idx;
    }
  }
  hunks.push({ start, end });

  const out: string[] = [`--- ${oldPath}`, `+++ ${newPath}`];
  for (const hunk of hunks) {
    const from = Math.max(0, hunk.start - context);
    const to = Math.min(numbered.length - 1, hunk.end + context);
    const slice = numbered.slice(from, to + 1);
    const oldCount = slice.filter((l) => l.type !== "add").length;
    const newCount = slice.filter((l) => l.type !== "del").length;
    const oldStart = slice.find((l) => l.oldNo !== null)?.oldNo ?? 0;
    const newStart = slice.find((l) => l.newNo !== null)?.newNo ?? 0;
    out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const line of slice) {
      const prefix = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
      out.push(`${prefix}${line.text}`);
    }
  }
  return out.join("\n") + "\n";
}
