/**
 * Security Auditor (big-pickle) — final-pass scan of the produced patches for
 * vulnerabilities, unsafe memory/IO patterns, secret leakage, and logic leaks.
 * Read-only: it reports, it does not patch.
 */

import type { FileDiff } from "../core/types.ts";
import { BaseAgent, type ToolName } from "./base.ts";

export interface SecurityInput {
  readonly goal: string;
  readonly diffs: readonly FileDiff[];
  readonly changedFiles: readonly string[];
}

export interface SecurityReport {
  readonly safe: boolean;
  readonly summary: string;
  readonly findings: readonly {
    readonly severity: "info" | "low" | "medium" | "high" | "critical";
    readonly category: string;
    readonly file: string | null;
    readonly detail: string;
    readonly recommendation: string;
  }[];
}

interface RawReport {
  safe?: unknown;
  summary?: unknown;
  findings?: unknown;
}

const ALLOWED: readonly ToolName[] = ["read_file", "list_files", "search_files"];

const AUDIT_CATEGORIES = [
  "injection (SQL/command/path)",
  "unsafe deserialization",
  "hardcoded secrets or credentials",
  "authentication/authorization gaps",
  "path traversal / sandbox escape",
  "resource leaks (files, sockets, handles)",
  "unsafe concurrency",
  "integer/overflow/bounds errors",
  "insecure defaults",
  "sensitive data logging",
];

export class SecurityAuditor extends BaseAgent<SecurityReport> {
  readonly role = "security-auditor" as const;

  protected allowedTools(): readonly ToolName[] {
    return ALLOWED;
  }

  protected systemPrompt(): string {
    return [
      "You are the SECURITY AUDITOR. You audit ONLY the changed files for exploitable defects.",
      `Focus areas: ${AUDIT_CATEGORIES.join("; ")}.`,
      "Read every changed file with read_file. Cite concrete lines and give an actionable recommendation.",
      "Set safe=false if any finding is high or critical.",
      'Final shape: {"safe": boolean, "summary": string, "findings": [{"severity": "info|low|medium|high|critical", "category": string, "file": string|null, "detail": string, "recommendation": string}]}',
    ].join("\n");
  }

  protected override finalize(value: unknown): SecurityReport {
    const raw = (value ?? {}) as RawReport;
    const allowed = new Set(["info", "low", "medium", "high", "critical"]);
    const findings = Array.isArray(raw.findings)
      ? (raw.findings as Record<string, unknown>[]).map((f) => ({
          severity: (allowed.has(String(f.severity)) ? String(f.severity) : "info") as SecurityReport["findings"][number]["severity"],
          category: typeof f.category === "string" ? f.category : "general",
          file: typeof f.file === "string" ? f.file : null,
          detail: typeof f.detail === "string" ? f.detail : "",
          recommendation: typeof f.recommendation === "string" ? f.recommendation : "",
        }))
      : [];
    const safe =
      typeof raw.safe === "boolean" ? raw.safe : !findings.some((f) => f.severity === "high" || f.severity === "critical");
    return { safe, summary: typeof raw.summary === "string" ? raw.summary : "", findings };
  }
}
