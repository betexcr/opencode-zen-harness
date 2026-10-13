import { describe, expect, it } from "vitest";

import {
  CATALOG_BASE_PATH,
  DEFAULT_CATALOG_LIMIT,
  DEFAULT_CATALOG_ORDER,
  DEFAULT_CATALOG_SORT,
  MAX_CATALOG_LIMIT,
  parseCatalogParams,
} from "@/features/storefront/queries/catalog-params";

describe("parseCatalogParams", () => {
  it("applies defaults when searchParams are absent", () => {
    const params = parseCatalogParams(undefined);
    expect(params.page).toBe(1);
    expect(params.limit).toBe(DEFAULT_CATALOG_LIMIT);
    expect(params.sortBy).toBe(DEFAULT_CATALOG_SORT);
    expect(params.order).toBe(DEFAULT_CATALOG_ORDER);
    expect(params.category).toBeUndefined();
    expect(params.q).toBeUndefined();
  });

  it("parses valid numeric and string params", () => {
    const params = parseCatalogParams({
      page: "3",
      limit: "24",
      sortBy: "price",
      order: "desc",
      category: "smartphones",
      q: "phone",
    });
    expect(params).toMatchObject({
      page: 3,
      limit: 24,
      sortBy: "price",
      order: "desc",
      category: "smartphones",
      q: "phone",
    });
  });

  it("falls back to safe defaults for invalid params", () => {
    const params = parseCatalogParams({
      page: "-2",
      limit: "abc",
      sortBy: "bogus",
      order: "sideways",
      category: "   ",
      q: "",
    });
    expect(params.page).toBe(1);
    expect(params.limit).toBe(DEFAULT_CATALOG_LIMIT);
    expect(params.sortBy).toBe(DEFAULT_CATALOG_SORT);
    expect(params.order).toBe(DEFAULT_CATALOG_ORDER);
    expect(params.category).toBeUndefined();
    expect(params.q).toBeUndefined();
  });

  it("clamps the page size to the hard maximum", () => {
    const params = parseCatalogParams({ limit: "9999" });
    expect(params.limit).toBe(MAX_CATALOG_LIMIT);
  });

  it("takes the first value from repeated query params", () => {
    const params = parseCatalogParams({ category: ["a", "b"], page: ["2", "4"] });
    expect(params.category).toBe("a");
    expect(params.page).toBe(2);
  });

  it("exposes the canonical catalogue base path", () => {
    expect(CATALOG_BASE_PATH).toBe("/products");
  });
});
