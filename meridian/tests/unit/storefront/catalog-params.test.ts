import { describe, expect, it } from "vitest";

import {
  CATALOG_BASE_PATH,
  CATALOG_DEFAULT_LIMIT,
  CATALOG_DEFAULT_ORDER,
  CATALOG_DEFAULT_PAGE,
  CATALOG_MAX_LIMIT,
  CATALOG_MIN_LIMIT,
  CATALOG_QUERY_KEY_ROOT,
  buildCatalogHref,
  catalogQueryKey,
  catalogToProductListParams,
  catalogToSearchParams,
  clampCatalogLimit,
  clampCatalogPage,
  isCatalogSortField,
  normalizeCatalogOrder,
  normalizeCatalogSortBy,
  parseCatalogParams,
} from "@/features/storefront/queries/catalog-params";

describe("catalog params", () => {
  describe("clampCatalogPage", () => {
    it("returns default for non-finite input", () => {
      expect(clampCatalogPage(Number.NaN)).toBe(CATALOG_DEFAULT_PAGE);
      expect(clampCatalogPage(Number.POSITIVE_INFINITY)).toBe(CATALOG_DEFAULT_PAGE);
      expect(clampCatalogPage(Number.NEGATIVE_INFINITY)).toBe(CATALOG_DEFAULT_PAGE);
    });

    it("clamps to minimum 1", () => {
      expect(clampCatalogPage(0)).toBe(1);
      expect(clampCatalogPage(-10)).toBe(1);
      expect(clampCatalogPage(-0.5)).toBe(1);
    });

    it("truncates fractional values", () => {
      expect(clampCatalogPage(2.7)).toBe(2);
      expect(clampCatalogPage(1.0001)).toBe(1);
    });

    it("preserves valid page numbers", () => {
      expect(clampCatalogPage(1)).toBe(1);
      expect(clampCatalogPage(5)).toBe(5);
    });
  });

  describe("clampCatalogLimit", () => {
    it("returns default for non-finite input", () => {
      expect(clampCatalogLimit(Number.NaN)).toBe(CATALOG_DEFAULT_LIMIT);
      expect(clampCatalogLimit(Number.POSITIVE_INFINITY)).toBe(CATALOG_DEFAULT_LIMIT);
      expect(clampCatalogLimit(Number.NEGATIVE_INFINITY)).toBe(CATALOG_DEFAULT_LIMIT);
    });

    it("clamps to [min, max]", () => {
      expect(clampCatalogLimit(0)).toBe(CATALOG_MIN_LIMIT);
      expect(clampCatalogLimit(-5)).toBe(CATALOG_MIN_LIMIT);
      expect(clampCatalogLimit(1000)).toBe(CATALOG_MAX_LIMIT);
      expect(clampCatalogLimit(CATALOG_MAX_LIMIT + 1)).toBe(CATALOG_MAX_LIMIT);
    });

    it("truncates fractional values", () => {
      expect(clampCatalogLimit(12.9)).toBe(12);
      expect(clampCatalogLimit(24.0004)).toBe(24);
    });

    it("preserves values in range", () => {
      expect(clampCatalogLimit(CATALOG_MIN_LIMIT)).toBe(CATALOG_MIN_LIMIT);
      expect(clampCatalogLimit(CATALOG_MAX_LIMIT)).toBe(CATALOG_MAX_LIMIT);
      expect(clampCatalogLimit(24)).toBe(24);
    });
  });

  describe("isCatalogSortField", () => {
    it("recognizes allowlisted fields", () => {
      expect(isCatalogSortField("title")).toBe(true);
      expect(isCatalogSortField("price")).toBe(true);
      expect(isCatalogSortField("rating")).toBe(true);
      expect(isCatalogSortField("stock")).toBe(true);
      expect(isCatalogSortField("discountPercentage")).toBe(true);
    });

    it("rejects unknown fields", () => {
      expect(isCatalogSortField("name")).toBe(false);
      expect(isCatalogSortField("createdAt")).toBe(false);
      expect(isCatalogSortField("")).toBe(false);
    });
  });

  describe("normalizeCatalogSortBy", () => {
    it("trims and validates", () => {
      expect(normalizeCatalogSortBy("price")).toBe("price");
      expect(normalizeCatalogSortBy("  rating  ")).toBe("rating");
    });

    it("rejects unknown fields", () => {
      expect(normalizeCatalogSortBy("popularity")).toBeUndefined();
      expect(normalizeCatalogSortBy("unknown")).toBeUndefined();
    });

    it("handles undefined/empty", () => {
      expect(normalizeCatalogSortBy(undefined)).toBeUndefined();
      expect(normalizeCatalogSortBy("")).toBeUndefined();
      expect(normalizeCatalogSortBy("   ")).toBeUndefined();
    });
  });

  describe("normalizeCatalogOrder", () => {
    it("defaults to asc for unknown", () => {
      expect(normalizeCatalogOrder(undefined)).toBe("asc");
      expect(normalizeCatalogOrder("")).toBe("asc");
      expect(normalizeCatalogOrder("ascending")).toBe("asc");
      expect(normalizeCatalogOrder("random")).toBe("asc");
    });

    it("coerces to desc only for exact desc (case-insensitive)", () => {
      expect(normalizeCatalogOrder("desc")).toBe("desc");
      expect(normalizeCatalogOrder("DESC")).toBe("desc");
      expect(normalizeCatalogOrder("  desc  ")).toBe("desc");
    });
  });

  describe("parseCatalogParams", () => {
    it("returns defaults for empty input", () => {
      const params = parseCatalogParams();
      expect(params).toEqual({
        page: CATALOG_DEFAULT_PAGE,
        limit: CATALOG_DEFAULT_LIMIT,
        order: CATALOG_DEFAULT_ORDER,
      });
      expect(params.category).toBeUndefined();
      expect(params.q).toBeUndefined();
      expect(params.sortBy).toBeUndefined();
    });

    it("parses numeric page/limit", () => {
      const params = parseCatalogParams({ page: "2", limit: "24" });
      expect(params.page).toBe(2);
      expect(params.limit).toBe(24);
    });

    it("clamps invalid page/limit values", () => {
      expect(parseCatalogParams({ page: "0", limit: "200" })).toEqual(
        expect.objectContaining({
          page: 1,
          limit: CATALOG_MAX_LIMIT,
        }),
      );
      expect(parseCatalogParams({ page: "-5", limit: "0" })).toEqual(
        expect.objectContaining({
          page: 1,
          limit: CATALOG_MIN_LIMIT,
        }),
      );
      expect(parseCatalogParams({ page: "foo", limit: "bar" })).toEqual(
        expect.objectContaining({
          page: CATALOG_DEFAULT_PAGE,
          limit: CATALOG_DEFAULT_LIMIT,
        }),
      );
      expect(parseCatalogParams({ page: "3.9", limit: "12.7" })).toEqual(
        expect.objectContaining({
          page: 3,
          limit: 12,
        }),
      );
    });

    it("trims and passes through category and q", () => {
      const params = parseCatalogParams({ category: "laptops", q: "macbook" });
      expect(params.category).toBe("laptops");
      expect(params.q).toBe("macbook");
    });

    it("collapses blank category/q to undefined", () => {
      const params = parseCatalogParams({ category: "   ", q: "" });
      expect(params.category).toBeUndefined();
      expect(params.q).toBeUndefined();
    });

    it("handles repeated URLSearchParams values (arrays)", () => {
      const params = parseCatalogParams({
        page: ["2", "3"],
        limit: ["24"],
        category: ["phones"],
        q: ["case"],
      });
      expect(params.page).toBe(2);
      expect(params.limit).toBe(24);
      expect(params.category).toBe("phones");
      expect(params.q).toBe("case");
    });

    it("normalizes sortBy allowlist and order coercion", () => {
      expect(parseCatalogParams({ sortBy: "price", order: "desc" })).toEqual(
        expect.objectContaining({ sortBy: "price", order: "desc" }),
      );
      expect(parseCatalogParams({ sortBy: "  rating  ", order: "DESC" })).toEqual(
        expect.objectContaining({ sortBy: "rating", order: "desc" }),
      );
      expect(parseCatalogParams({ sortBy: "popularity", order: "desc" })).toEqual(
        expect.objectContaining({ sortBy: undefined, order: "desc" }),
      );
      expect(parseCatalogParams({ sortBy: "invalid", order: "random" })).toEqual(
        expect.objectContaining({ sortBy: undefined, order: "asc" }),
      );
    });

    it("supports combined search/category/sort cases", () => {
      const params = parseCatalogParams({
        page: "1",
        limit: "12",
        category: "smartphones",
        q: "pro",
        sortBy: "price",
        order: "asc",
      });
      expect(params).toEqual({
        page: 1,
        limit: 12,
        category: "smartphones",
        q: "pro",
        sortBy: "price",
        order: "asc",
      });
    });
  });

  describe("catalogToProductListParams", () => {
    it("maps page/limit to skip correctly", () => {
      expect(catalogToProductListParams({ page: 1, limit: 12, order: "asc" })).toEqual(
        expect.objectContaining({ limit: 12, skip: 0, sortBy: undefined, order: undefined }),
      );
      expect(catalogToProductListParams({ page: 2, limit: 12, order: "asc" })).toEqual(
        expect.objectContaining({ limit: 12, skip: 12 }),
      );
      expect(catalogToProductListParams({ page: 3, limit: 24, order: "asc" })).toEqual(
        expect.objectContaining({ limit: 24, skip: 48 }),
      );
    });

    it("only sends order when sortBy is present", () => {
      expect(catalogToProductListParams({ page: 1, limit: 12, sortBy: "price", order: "asc" }).order).toBe("asc");
      expect(catalogToProductListParams({ page: 1, limit: 12, sortBy: "price", order: "desc" }).order).toBe("desc");
      expect(catalogToProductListParams({ page: 1, limit: 12, order: "desc" }).order).toBeUndefined();
    });

    it("normalizes/clamps inputs", () => {
      const result = catalogToProductListParams({
        page: 0,
        limit: 200,
        sortBy: "popularity",
        order: "random",
      } as unknown as Parameters<typeof catalogToProductListParams>[0]);
      expect(result.limit).toBe(CATALOG_MAX_LIMIT);
      expect(result.skip).toBe(0); // page clamped to 1
      expect(result.sortBy).toBeUndefined();
      expect(result.order).toBeUndefined();
    });
  });

  describe("catalogToSearchParams", () => {
    it("omits default values", () => {
      const params = { page: 1, limit: 12, order: "asc" } as Parameters<typeof catalogToSearchParams>[0];
      expect(catalogToSearchParams(params)).toEqual({});
    });

    it("includes non-default values", () => {
      const params = { page: 2, limit: 24, order: "asc" } as Parameters<typeof catalogToSearchParams>[0];
      expect(catalogToSearchParams(params)).toEqual({ page: "2", limit: "24" });
    });

    it("includes category, q, sortBy, and order when set", () => {
      const params = {
        page: 1,
        limit: 12,
        category: "laptops",
        q: "macbook",
        sortBy: "price",
        order: "desc",
      } as Parameters<typeof catalogToSearchParams>[0];
      expect(catalogToSearchParams(params)).toEqual({
        category: "laptops",
        q: "macbook",
        sortBy: "price",
        order: "desc",
      });
    });

    it("omits falsy category/q (empty strings)", () => {
      const params = {
        page: 1,
        limit: 12,
        category: "",
        q: "",
        order: "asc",
      } as Parameters<typeof catalogToSearchParams>[0];
      expect(catalogToSearchParams(params)).toEqual({});
    });
  });

  describe("buildCatalogHref", () => {
    it("builds base path when no params", () => {
      expect(buildCatalogHref({ page: 1, limit: 12, order: "asc" })).toBe(CATALOG_BASE_PATH);
    });

    it("builds href with query string (omits default order)", () => {
      const href = buildCatalogHref({ page: 2, limit: 24, sortBy: "price", order: "asc" } as Parameters<typeof buildCatalogHref>[0]);
      const url = new URL(href, "http://localhost");
      expect(url.pathname).toBe(CATALOG_BASE_PATH);
      expect(url.searchParams.get("page")).toBe("2");
      expect(url.searchParams.get("limit")).toBe("24");
      expect(url.searchParams.get("sortBy")).toBe("price");
      expect(url.searchParams.get("order")).toBeNull();
    });

    it("respects custom basePath", () => {
      const href = buildCatalogHref({ page: 2, limit: 12, order: "asc" }, { basePath: "/catalog" });
      expect(href).toBe("/catalog?page=2");
    });
  });

  describe("catalogQueryKey", () => {
    it("uses root key and serialized params with nulls for undefined", () => {
      const key = catalogQueryKey({ page: 1, limit: 12, order: "asc" });
      expect(key[0]).toBe(CATALOG_QUERY_KEY_ROOT[0]);
      expect(key[1]).toBe(CATALOG_QUERY_KEY_ROOT[1]);
      expect(key[2]).toEqual({
        page: 1,
        limit: 12,
        category: null,
        q: null,
        sortBy: null,
        order: "asc",
      });
    });

    it("includes defined values", () => {
      const key = catalogQueryKey({
        page: 2,
        limit: 24,
        category: "phones",
        q: "case",
        sortBy: "price",
        order: "desc",
      });
      expect(key[2]).toEqual({
        page: 2,
        limit: 24,
        category: "phones",
        q: "case",
        sortBy: "price",
        order: "desc",
      });
    });

    it("produces stable structure for round-tripped params", () => {
      const input = { page: "2", limit: "24", category: "laptops", q: "mac", sortBy: "rating", order: "desc" };
      const parsed = parseCatalogParams(input);
      const key = catalogQueryKey(parsed);
      expect(key[2].category).toBe("laptops");
      expect(key[2].q).toBe("mac");
      expect(key[2].sortBy).toBe("rating");
      expect(key[2].order).toBe("desc");
    });
  });

  describe("round-tripping through URLSearchParams", () => {
    it("round-trips defaults", () => {
      const parsed = parseCatalogParams({});
      const sp = new URLSearchParams(catalogToSearchParams(parsed));
      const roundTripped = parseCatalogParams(Object.fromEntries(sp.entries()));
      expect(roundTripped).toEqual(parsed);
    });

    it("round-trips various combinations", () => {
      const cases = [
        { page: "2", limit: "12" },
        { page: "1", limit: "24", sortBy: "price", order: "desc" },
        { page: "3", limit: "12", category: "smartphones", q: "pro" },
        { page: "1", limit: "100", sortBy: "rating", order: "desc" },
        { page: "5", limit: "1", category: "fragrances", q: "test", sortBy: "stock", order: "asc" },
      ];
      for (const c of cases) {
        const parsed = parseCatalogParams(c);
        const sp = new URLSearchParams(catalogToSearchParams(parsed));
        const roundTripped = parseCatalogParams(Object.fromEntries(sp.entries()));
        expect(roundTripped).toEqual(parsed);
      }
    });

    it("preserves search/category/sort combinations", () => {
      const input = { page: "1", limit: "12", category: "laptops", q: "macbook", sortBy: "price", order: "asc" };
      const parsed = parseCatalogParams(input);
      expect(parsed).toEqual({ page: 1, limit: 12, category: "laptops", q: "macbook", sortBy: "price", order: "asc" });
      const toSp = catalogToSearchParams(parsed);
      // defaults omitted
      expect(toSp).toEqual({ category: "laptops", q: "macbook", sortBy: "price" });
      const fromSp = parseCatalogParams(toSp);
      expect(fromSp).toEqual(parsed);
    });
  });
});
