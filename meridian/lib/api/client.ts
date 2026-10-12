import { ZodError, type ZodType } from "zod";

/**
 * Centralized HTTP client for the DummyJSON API.
 *
 * Every network call in Meridian MUST go through this module. Components and
 * hooks never call `fetch` directly; they consume the typed query functions in
 * `lib/api/*.ts`, which in turn call `request`/`requestList` here. This keeps
 * base-URL configuration, timeout handling, error normalization, and response
 * validation in exactly one place.
 */

/** Default DummyJSON origin, overridable via `NEXT_PUBLIC_DUMMYJSON_BASE_URL`. */
export const DEFAULT_BASE_URL = "https://dummyjson.com";

/** Default request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * The normalized shape of every failure the client can produce. `kind` lets
 * callers distinguish transport problems (`network`, `timeout`) from server and
 * payload problems (`http`, `parse`) without inspecting raw errors.
 */
export type ApiErrorKind = "network" | "timeout" | "http" | "parse";

/** Typed, serializable error thrown by every function in `lib/api`. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly url: string | null;
  readonly details: unknown;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number | null; url?: string | null; details?: unknown } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status ?? null;
    this.url = options.url ?? null;
    this.details = options.details;
  }

  /** Narrow helper for the common "should I offer retry?" decision. */
  get isRetryable(): boolean {
    return this.kind === "network" || this.kind === "timeout" || this.kind === "http";
  }
}

/** Resolve the API base URL, tolerating a trailing slash and empty values. */
export function getBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_DUMMYJSON_BASE_URL;
  const base = configured && configured.trim().length > 0 ? configured.trim() : DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

/** Parameters accepted by `request`. */
export interface RequestOptions {
  method?: "GET" | "POST";
  /** Query string values; `undefined`, `null`, and empty strings are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** JSON request body, serialized automatically for non-GET methods. */
  body?: unknown;
  /** Per-request timeout override in milliseconds. */
  timeoutMs?: number;
  /** Caller-provided abort signal, merged with the timeout signal. */
  signal?: AbortSignal;
  /** Zod schema used to validate the parsed JSON payload. */
  schema?: ZodType<unknown>;
  /** Override the base URL (used by tests). */
  baseUrl?: string;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Type guard used to detect Zod's validation error without importing internals. */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/**
 * Perform a request, enforce a timeout, and validate the JSON response.
 *
 * Failure mapping:
 * - request aborted because the timeout elapsed -> `ApiError(kind: "timeout")`
 * - other transport failure (DNS, offline, CORS)   -> `ApiError(kind: "network")`
 * - non-2xx HTTP status                            -> `ApiError(kind: "http")`
 * - JSON parse failure or Zod validation failure   -> `ApiError(kind: "parse")`
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    query,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    schema,
    baseUrl = getBaseUrl(),
  } = options;

  const url = buildUrl(baseUrl, path, query);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const fetchPromise = fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: controller.signal,
    cache: "no-store",
  });

  const abortPromise = new Promise<never>((_resolve, abortReject) => {
    controller.signal.addEventListener(
      "abort",
      () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        abortReject(error);
      },
      { once: true },
    );
  });

  let response: Response;
  try {
    response = await Promise.race([fetchPromise, abortPromise]);
  } catch (error) {
    if (timedOut) {
      throw new ApiError("timeout", `Request to ${url} timed out after ${timeoutMs}ms.`, {
        url,
      });
    }
    if (isAbortError(error)) {
      throw new ApiError("network", `Request to ${url} was aborted.`, { url });
    }
    throw new ApiError("network", `Network request to ${url} failed.`, {
      url,
      details: error,
    });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onExternalAbort);
  }

  if (!response.ok) {
    throw new ApiError("http", `Request to ${url} failed with status ${response.status}.`, {
      status: response.status,
      url,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new ApiError("parse", `Response from ${url} was not valid JSON.`, {
      status: response.status,
      url,
      details: error,
    });
  }

  if (!schema) {
    return payload as T;
  }

  try {
    return schema.parse(payload) as T;
  } catch (error) {
    const message =
      error instanceof ZodError
        ? `Response from ${url} did not match the expected shape: ${error.issues
            .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
            .join("; ")}`
        : `Response from ${url} failed validation.`;
    throw new ApiError("parse", message, {
      status: response.status,
      url,
      details: error,
    });
  }
}

/** Narrow `ApiError` from an unknown caught value. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Human-readable message for any thrown value, safe for UI use. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
