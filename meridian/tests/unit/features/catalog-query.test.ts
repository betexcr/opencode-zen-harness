import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit coverage for the server-side catalogue data function.
 *
 * `fetchCatalogPage` (features/storefront/queries/catalog.ts) is the single
 * resolver that turns normalized URL params into the matching DummyJSON fetch.
 * It is a "use cache" server function, so the Next cache runtime is stubbed
 * here; the network layer is mocked so the tests assert *routing* (search vs.
 * category vs. generic list) and offset math without touching the sample API.
 */

const mocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  searchProducts: vi.fn(),
  getProductsByCategory: vi.fn(),
}));

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

vi.mock("@/lib/api/products", () => ({
  getProducts: mocks.getProducts,
  searchProducts: mocks.searchProducts,
  getProductsByCategory: mocks.getProductsByCategory,
}));

import {
  CATALOG_BASE_PATH,
  fetchCatalogPage,
} from "@/features/storefront/queries/catalog";
import type { CatalogParams } from "@/features/storefront/queries/catalog-params";

const emptyPage = { products: [], total: 0, skip: 0, limit: 0 };

function makeParams(overrides: Partial<CatalogParams> = {}): CatalogParams {
  return {
    page: 1,
    limit: 12,
    sortBy: "title",
    order: "asc",
    ...overrides,
  } as CatalogParams;
}

describe("fetchCatalogPage", () => {
  beforeEach(() => {
    mocks.getProducts.mockReset().mockResolvedValue(emptyPage);
    mocks.searchProducts.mockReset().mockResolvedValue(emptyPage);
    mocks.getProductsByCategory.mockReset().mockResolvedValue(emptyPage);
  });

  it("derives skip from page/limit and forwards sort to the generic list endpoint", async () => {
    await fetchCatalogPage(makeParams({ page: 3, limit: 10, sortBy: "price", order: "desc" }));

    expect(mocks.getProducts).toHaveBeenCalledTimes(1);
    expect(mocks.getProducts).toHaveBeenCalledWith({
      limit: 10,
      skip: 20,
      sortBy: "price",
      order: "desc",
    });
    expect(mocks.searchProducts).not.toHaveBeenCalled();
    expect(mocks.getProductsByCategory).not.toHaveBeenCalled();
  });

  it("routes a query to search with the same list params", async () => {
    await fetchCatalogPage(makeParams({ q: "phone", page: 2, limit: 5 }));

    expect(mocks.searchProducts).toHaveBeenCalledTimes(1);
    const [term, listParams] = mocks.searchProducts.mock.calls[0];
    expect(term).toBe("phone");
    expect(listParams).toMatchObject({ limit: 5, skip: 5 });
    expect(mocks.getProducts).not.toHaveBeenCalled();
  });

  it("routes a category to the by-category endpoint when there is no query", async () => {
    await fetchCatalogPage(makeParams({ category: "smartphones" }));

    expect(mocks.getProductsByCategory).toHaveBeenCalledTimes(1);
    expect(mocks.getProductsByCategory.mock.calls[0][0]).toBe("smartphones");
    expect(mocks.getProducts).not.toHaveBeenCalled();
    expect(mocks.searchProducts).not.toHaveBeenCalled();
  });

  it("prefers search over the category filter when both are supplied", async () => {
    await fetchCatalogPage(makeParams({ q: "phone", category: "smartphones" }));

    expect(mocks.searchProducts).toHaveBeenCalledTimes(1);
    expect(mocks.getProductsByCategory).not.toHaveBeenCalled();
  });

  it("re-exports the canonical catalogue base path", () => {
    expect(typeof CATALOG_BASE_PATH).toBe("string");
    expect(CATALOG_BASE_PATH.length).toBeGreaterThan(0);
  });
});
