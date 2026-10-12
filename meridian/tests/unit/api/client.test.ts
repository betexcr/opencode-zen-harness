import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ApiError,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  getBaseUrl,
  isApiError,
  request,
  toErrorMessage,
} from "@/lib/api/client";

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

describe("client.getBaseUrl", () => {
  const key = "NEXT_PUBLIC_DUMMYJSON_BASE_URL";
  const original = process.env[key];

  afterEach(() => {
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  });

  it("defaults to the DummyJSON origin", () => {
    delete process.env[key];
    expect(getBaseUrl()).toBe(DEFAULT_BASE_URL);
  });

  it("uses the configured value and strips trailing slashes", () => {
    process.env[key] = "https://example.test///";
    expect(getBaseUrl()).toBe("https://example.test");
  });

  it("falls back to the default for a blank configuration", () => {
    process.env[key] = "   ";
    expect(getBaseUrl()).toBe(DEFAULT_BASE_URL);
  });
});

describe("client.request", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exposes documented defaults", () => {
    expect(DEFAULT_BASE_URL).toBe("https://dummyjson.com");
    expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
  });

  it("builds the URL from path + query and drops empty values", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await request("/products", {
      baseUrl: "https://example.test",
      query: { limit: 10, skip: 0, select: "title", unused: undefined, nil: null, blank: "" },
    });
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    const url = new URL(calledUrl);
    expect(`${url.origin}${url.pathname}`).toBe("https://example.test/products");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("skip")).toBe("0");
    expect(url.searchParams.get("select")).toBe("title");
    expect(url.searchParams.has("unused")).toBe(false);
    expect(url.searchParams.has("nil")).toBe(false);
    expect(url.searchParams.has("blank")).toBe(false);
  });

  it("normalizes a path that lacks a leading slash", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await request("products", { baseUrl: "https://example.test" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.test/products");
  });

  it("returns parsed JSON when no schema is provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ value: 42 }));
    await expect(
      request<{ value: number }>("/x", { baseUrl: "https://example.test" }),
    ).resolves.toEqual({ value: 42 });
  });

  it("validates and returns the payload when a schema is provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ a: 1 }));
    const schema = z.object({ a: z.number() });
    await expect(
      request("/x", { baseUrl: "https://example.test", schema }),
    ).resolves.toEqual({ a: 1 });
  });

  it("sends POST bodies with the correct method and headers", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await request("/auth/login", {
      method: "POST",
      baseUrl: "https://example.test",
      body: { username: "emilys" },
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ username: "emilys" }));
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Accept).toBe("application/json");
  });

  it("does not set a JSON content type for GET requests", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await request("/x", { baseUrl: "https://example.test" });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });
});

describe("client.request error mapping", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("throws ApiError(kind:'http') for non-2xx responses", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "nope" }, 404));
    const error = await request("/products/999999", { baseUrl: "https://example.test" }).catch(
      (e: unknown) => e,
    );
    expect(isApiError(error)).toBe(true);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("http");
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).url).toContain("/products/999999");
  });

  it("throws ApiError(kind:'parse') when the body is not valid JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Response);
    const error = await request("/x", { baseUrl: "https://example.test" }).catch(
      (e: unknown) => e,
    );
    expect((error as ApiError).kind).toBe("parse");
  });

  it("throws ApiError(kind:'parse') with issue detail when schema validation fails", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ a: "not-a-number" }));
    const error = await request("/x", {
      baseUrl: "https://example.test",
      schema: z.object({ a: z.number() }),
    }).catch((e: unknown) => e);
    expect((error as ApiError).kind).toBe("parse");
    expect((error as ApiError).message).toContain("a");
  });

  it("throws ApiError(kind:'network') for transport failures", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await request("/x", { baseUrl: "https://example.test" }).catch(
      (e: unknown) => e,
    );
    expect((error as ApiError).kind).toBe("network");
    expect((error as ApiError).isRetryable).toBe(true);
  });

  it("throws ApiError(kind:'timeout') when the deadline elapses", async () => {
    fetchMock.mockImplementation(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const error = await request("/slow", {
      baseUrl: "https://example.test",
      timeoutMs: 15,
    }).catch((e: unknown) => e);
    expect((error as ApiError).kind).toBe("timeout");
    expect((error as ApiError).message).toContain("timed out");
  });

  it("throws ApiError(kind:'network') when an external signal aborts", async () => {
    fetchMock.mockImplementation(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const controller = new AbortController();
    const promise = request("/x", {
      baseUrl: "https://example.test",
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    controller.abort();
    const error = await promise.catch((e: unknown) => e);
    expect((error as ApiError).kind).toBe("network");
  });
});

describe("client helpers", () => {
  it("isApiError narrows ApiError instances only", () => {
    expect(isApiError(new ApiError("http", "x"))).toBe(true);
    expect(isApiError(new Error("x"))).toBe(false);
    expect(isApiError(null)).toBe(false);
  });

  it("toErrorMessage surfaces known messages and a safe fallback", () => {
    expect(toErrorMessage(new ApiError("http", "boom"))).toBe("boom");
    expect(toErrorMessage(new Error("plain"))).toBe("plain");
    expect(toErrorMessage("weird")).toBe("Something went wrong. Please try again.");
  });

  it("marks only transport/http failures as retryable", () => {
    expect(new ApiError("http", "x").isRetryable).toBe(true);
    expect(new ApiError("network", "x").isRetryable).toBe(true);
    expect(new ApiError("timeout", "x").isRetryable).toBe(true);
    expect(new ApiError("parse", "x").isRetryable).toBe(false);
  });
});
