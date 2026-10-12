import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  filterProducts,
  getProduct,
  getProductCategories,
  getProductCategoryList,
  getProducts,
  getProductsByCategory,
  searchProducts,
  toListQuery,
} from "@/lib/api/products";
import { makeProduct } from "./fixtures";

const BASE = "https://example.test";

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

function lastUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
  const call = fetchMock.mock.calls.at(-1);
  return new URL(call?.[0] as string);
}

describe("products API", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("toListQuery joins select arrays and drops blanks", () => {
    const query = toListQuery({
      limit: 10,
      skip: 5,
      sortBy: "price",
      order: "desc",
      select: ["title", " ", "price"],
    });
    expect(query).toEqual({
      limit: 10,
      skip: 5,
      sortBy: "price",
      order: "desc",
      select: "title,price",
    });
  });

  it("toListQuery returns undefined select for empty input", () => {
    expect(toListQuery({ select: ["  "] }).select).toBeUndefined();
    expect(toListQuery({ select: "   " }).select).toBeUndefined();
  });

  it("getProducts calls /products with pagination and sorting", async () => {
    const payload = { products: [makeProduct()], total: 194, skip: 0, limit: 10 };
    fetchMock.mockResolvedValue(jsonResponse(payload));
    const result = await getProducts(
      { limit: 10, skip: 0, sortBy: "rating", order: "desc", select: ["title", "rating"] },
      { baseUrl: BASE },
    );
    const url = lastUrl(fetchMock);
    expect(url.pathname).toBe("/products");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("sortBy")).toBe("rating");
    expect(url.searchParams.get("order")).toBe("desc");
    expect(url.searchParams.get("select")).toBe("title,rating");
    expect(result.products[0]?.id).toBe(1);
    expect(result.total).toBe(194);
  });

  it("getProduct encodes the id into the path", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeProduct({ id: 2 })));
    const product = await getProduct(2, { baseUrl: BASE });
    expect(lastUrl(fetchMock).pathname).toBe("/products/2");
    expect(product.id).toBe(2);
  });

  it("getProduct throws a parse ApiError for a malformed product", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1, title: "short" }));
    const error = await getProduct(1, { baseUrl: BASE }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("parse");
  });

  it("getProduct throws an http ApiError on 404", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "not found" }, 404));
    const error = await getProduct(999999, { baseUrl: BASE }).catch((e: unknown) => e);
    expect((error as ApiError).kind).toBe("http");
    expect((error as ApiError).status).toBe(404);
  });

  it("searchProducts trims the term and forwards list options", async () => {
    const payload = { products: [], total: 0, skip: 0, limit: 5 };
    fetchMock.mockResolvedValue(jsonResponse(payload));
    await searchProducts("  mascara  ", { limit: 5 }, { baseUrl: BASE });
    const url = lastUrl(fetchMock);
    expect(url.pathname).toBe("/products/search");
    expect(url.searchParams.get("q")).toBe("mascara");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("getProductsByCategory encodes the slug", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ products: [], total: 0, skip: 0, limit: 10 }));
    await getProductsByCategory("home-decoration", { limit: 10 }, { baseUrl: BASE });
    expect(lastUrl(fetchMock).pathname).toBe("/products/category/home-decoration");
  });

  it("getProductCategories parses the bare array response", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { slug: "beauty", name: "Beauty", url: "https://dummyjson.com/products/category/beauty" },
      ]),
    );
    const categories = await getProductCategories({ baseUrl: BASE });
    expect(lastUrl(fetchMock).pathname).toBe("/products/categories");
    expect(categories).toHaveLength(1);
    expect(categories[0]?.slug).toBe("beauty");
  });

  it("getProductCategories rejects a wrapped object instead of an array", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ categories: [] }));
    const error = await getProductCategories({ baseUrl: BASE }).catch((e: unknown) => e);
    expect((error as ApiError).kind).toBe("parse");
  });

  it("getProductCategoryList parses the bare slug array", async () => {
    fetchMock.mockResolvedValue(jsonResponse(["beauty", "fragrances"]));
    const list = await getProductCategoryList({ baseUrl: BASE });
    expect(lastUrl(fetchMock).pathname).toBe("/products/category-list");
    expect(list).toEqual(["beauty", "fragrances"]);
  });

  it("filterProducts sends both key and value", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ products: [makeProduct()], total: 1, skip: 0, limit: 10 }));
    await filterProducts({ key: "category", value: "beauty", limit: 10 }, { baseUrl: BASE });
    const url = lastUrl(fetchMock);
    expect(url.pathname).toBe("/products/filter");
    expect(url.searchParams.get("key")).toBe("category");
    expect(url.searchParams.get("value")).toBe("beauty");
    expect(url.searchParams.get("limit")).toBe("10");
  });

  it("filterProducts forwards numeric values", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ products: [], total: 0, skip: 0, limit: 10 }));
    await filterProducts({ key: "rating", value: 5 }, { baseUrl: BASE });
    expect(lastUrl(fetchMock).searchParams.get("value")).toBe("5");
  });
});
