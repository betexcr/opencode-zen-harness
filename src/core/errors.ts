/**
 * Error taxonomy and the resiliency primitives. Every agent invocation is
 * wrapped in a strict boundary that catches, classifies, and retries with
 * exponential backoff + jitter.
 *
 * Retry classification is centralised in {@link isRetryableError} so that the
 * low-level client and the high-level agent boundary agree: a fatal transport
 * or auth failure (e.g. the Zen free-tier 403) is NEVER retried, while agent
 * logic failures (bad JSON, max steps, tool errors) are.
 */

export class HarnessError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  override readonly cause?: unknown;
  constructor(code: string, message: string, details: Record<string, unknown> = {}, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
    if (cause !== undefined) this.cause = cause;
  }
}

export class SandboxViolation extends HarnessError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("SANDBOX_VIOLATION", message, details);
  }
}

export class ToolExecutionError extends HarnessError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("TOOL_EXECUTION", message, details);
  }
}

export class ModelCallError extends HarnessError {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean, details: Record<string, unknown> = {}) {
    super("MODEL_CALL", message, details);
    this.retryable = retryable;
  }
}

export class AgentError extends HarnessError {
  readonly role: string;
  constructor(role: string, message: string, details: Record<string, unknown> = {}) {
    super("AGENT_ERROR", message, { role, ...details });
    this.role = role;
  }
}

export class RetryExhaustedError extends HarnessError {
  readonly attempts: number;
  constructor(message: string, attempts: number, details: Record<string, unknown> = {}, cause?: unknown) {
    super("RETRY_EXHAUSTED", message, { attempts, ...details }, cause);
    this.attempts = attempts;
  }
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: Error };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(error: unknown): Result<T> {
  return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Walk the `cause` chain to the originating error. */
export function rootCause(error: unknown): unknown {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (
    current instanceof Error &&
    "cause" in current &&
    (current as { cause?: unknown }).cause !== undefined &&
    !seen.has(current)
  ) {
    seen.add(current);
    current = (current as { cause?: unknown }).cause;
  }
  return current;
}

/**
 * Single source of truth for retryability across all layers.
 *  - Sandbox violations and exhausted retries: never retry.
 *  - Model call errors: retry only if flagged retryable (network/5xx/429).
 *  - Everything else (agent logic, malformed output, tool bugs): retry.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof SandboxViolation) return false;
  if (error instanceof RetryExhaustedError) return false;
  if (error instanceof ModelCallError) return error.retryable;
  return true;
}

/**
 * A fatal (= configuration/authorization) model error that will not succeed on
 * retry and should abort the whole run.
 */
export function isFatalModelError(error: unknown): boolean {
  const root = rootCause(error);
  return root instanceof ModelCallError && !root.retryable;
}

export interface RetryOptions {
  readonly retries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly isRetryable?: (error: unknown) => boolean;
  readonly onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export const DEFAULT_RETRY: RetryOptions = {
  retries: 4,
  baseDelayMs: 400,
  maxDelayMs: 8_000,
};

/**
 * Execute `fn` with bounded exponential backoff and full jitter.
 *
 * A non-retryable error is rethrown AS-IS (preserving its type and flags) so
 * upstream boundaries can classify it correctly. Only when retryable attempts
 * are exhausted is a {@link RetryExhaustedError} raised, carrying the original
 * error as its `cause`.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: Partial<RetryOptions> = {}): Promise<T> {
  const cfg: RetryOptions = { ...DEFAULT_RETRY, ...options };
  const classify = cfg.isRetryable ?? isRetryableError;
  let lastError: unknown = new Error("withRetry: no attempt executed");

  for (let attempt = 1; attempt <= cfg.retries + 1; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (!classify(error)) throw error; // fatal: preserve the original error
      if (attempt > cfg.retries) break; // budget exhausted
      const exp = Math.min(cfg.maxDelayMs, cfg.baseDelayMs * 2 ** (attempt - 1));
      const delay = Math.floor(exp / 2 + Math.random() * (exp / 2));
      cfg.onRetry?.(error, attempt, delay);
      await sleep(delay);
    }
  }

  throw new RetryExhaustedError(lastError instanceof Error ? lastError.message : String(lastError), cfg.retries + 1, {
    cause: lastError instanceof Error ? lastError.name : typeof lastError,
  }, lastError);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
