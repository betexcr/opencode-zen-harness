import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  ApiError,
  isApiError,
  request,
  toErrorMessage,
} from "@/lib/api/client";

const schema = z.object({ id: z.number(), title: z.string() });

/** Minimal duck-typed Response; the client only reads ok/status/json. */
function makeResponse(
  body: unknown,
  options: { status?: number; invalidJson?: boolean } = {},
): Response {
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (options.invalidJson) throw new SyntaxError("Unexpected token");
      return body;
    },
  } as unknown as Response;
}

/** A fetch mock typed with the real signature so call arguments are inspectable. */
function typedFetchMock(impl: () => Promise<Response>) {
  return vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >(impl);
}

const BASE = "https://example.test";

describe("api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("parses a valid response with the supplied schema", async () => {
    vi.stubGlobal(
      "fetch",
      typedFetchMock(async () => makeResponse({ id: 1, title: "Widget" })),
    );

    await expect(
      request("/products/1", { baseUrl: BASE, schema }),
    ).resolves.toEqual({ id: 1, title: "Widget" });
  });

  it("builds the query string and drops empty values", async () => {
    const fetchMock = typedFetchMock(async () =>
      makeResponse({ id: 1, title: "Widget" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await request("/products", {
      baseUrl: BASE,
      query: {
        limit: 8,
        sortBy: "rating",
        order: "desc",
        select: undefined,
        q: "",
      },
      schema,
    });

    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toBe(
      "https://example.test/products?limit=8&sortBy=rating&order=desc",
    );
  });

  it("throws a parse ApiError when the payload fails the schema", async () => {
    vi.stubGlobal(
      "fetch",
      typedFetchMock(async () => makeResponse({ id: "not-a-number" })),
    );

    await expect(
      request("/products/1", { baseUrl: BASE, schema }),
    ).rejects.toMatchObject({ kind: "parse" });
  });

  it("throws a parse ApiError when the body is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      typedFetchMock(async () => makeResponse(undefined, { invalidJson: true })),
    );

    const error: unknown = await request("/products/1", {
      baseUrl: BASE,
      schema,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("parse");
  });

  it("throws an http ApiError for a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      typedFetchMock(async () => makeResponse("", { status: 404 })),
    );

    const error: unknown = await request("/products/999", {
      baseUrl: BASE,
      schema,
    }).catch((caught: unknown) => caught);

    expect(isApiError(error)).toBe(true);
    expect((error as ApiError).kind).toBe("http");
    expect((error as ApiError).status).toBe(404);
  });

  it("maps transport failures to a network ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      typedFetchMock(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(
      request("/products", { baseUrl: BASE }),
    ).rejects.toMatchObject({ kind: "network" });
  });

  it("maps an elapsed timeout to a timeout ApiError", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      typedFetchMock(
        () => new Promise<Response>(() => undefined),
      ),
    );

    const promise = request("/products", { baseUrl: BASE, timeoutMs: 50 });
    const assertion = expect(promise).rejects.toMatchObject({ kind: "timeout" });

    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });

  it("produces safe, human-readable messages", () => {
    expect(
      toErrorMessage(new ApiError("http", "Boom", { status: 500 })),
    ).toBe("Boom");
    expect(toErrorMessage(new Error("Nope"))).toBe("Nope");
    expect(toErrorMessage("weird")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
