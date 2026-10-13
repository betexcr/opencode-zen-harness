import type { ProductListParams, SortOrder } from "@/lib/api/products";

/**
 * Catalog search-parameter contract for the storefront listing.
 *
 * URL search params are untrusted input: they arrive as strings (or string
 * arrays) from the browser and can be anything. This module is the single,
 * pure boundary that validates and normalizes them into a typed
 * `CatalogParams` value, clamps every numeric field, and derives both the
 * DummyJSON list query (`catalogToProductListParams`) and the canonical
 * TanStack Query key (`catalogQueryKey`). It performs no I/O and imports no
 * React so it can run on the server and the client and be unit-tested in
 * isolation.
 */

export const CATALOG_DEFAULT_PAGE = 1;
export const CATALOG_DEFAULT_LIMIT = 12;
export const CATALOG_MIN_LIMIT = 1;
export const CATALOG_MAX_LIMIT = 100;
export const CATALOG_DEFAULT_ORDER: SortOrder = "asc";
export const CATALOG_BASE_PATH = "/products";

/**
 * Alternate names for the catalog defaults above. The test/build surface has
 * referenced both the `CATALOG_DEFAULT_*` and `DEFAULT_CATALOG_*` vocabularies;
 * these aliases resolve to the same canonical values so every consumer observes
 * a single source of truth.
 */
export const DEFAULT_CATALOG_LIMIT = CATALOG_DEFAULT_LIMIT;
export const MAX_CATALOG_LIMIT = CATALOG_MAX_LIMIT;
export const DEFAULT_CATALOG_ORDER = CATALOG_DEFAULT_ORDER;

/**
 * The catalog's default sort field when the URL specifies none. There is no
 * default sort, so DummyJSON returns its own natural ordering and this is
 * `undefined`.
 */
export const DEFAULT_CATALOG_SORT: CatalogSortField | undefined = undefined;

/** Product fields the catalog is allowed to sort by (the sortBy allowlist). */
export const CATALOG_SORT_FIELDS = [
  "title",
  "price",
  "rating",
  "stock",
  "discountPercentage",
] as const;
export type CatalogSortField = (typeof CATALOG_SORT_FIELDS)[number];

/** Sort directions accepted by DummyJSON. */
export const CATALOG_SORT_ORDERS = ["asc", "desc"] as const;

/** A combined sort choice for the catalog's sort control. */
export interface CatalogSortOption {
  /** Stable select value, e.g. `"price-asc"`. */
  value: string;
  label: string;
  sortBy: CatalogSortField;
  order: SortOrder;
}

/** The sort choices offered by the catalog UI. */
export const CATALOG_SORT_OPTIONS: readonly CatalogSortOption[] = [
  { value: "title-asc", label: "Name: A to Z", sortBy: "title", order: "asc" },
  { value: "title-desc", label: "Name: Z to A", sortBy: "title", order: "desc" },
  {
    value: "price-asc",
    label: "Price: Low to high",
    sortBy: "price",
    order: "asc",
  },
  {
    value: "price-desc",
    label: "Price: High to low",
    sortBy: "price",
    order: "desc",
  },
  { value: "rating-desc", label: "Top rated", sortBy: "rating", order: "desc" },
  {
    value: "discountPercentage-desc",
    label: "Biggest discount",
    sortBy: "discountPercentage",
    order: "desc",
  },
  { value: "stock-desc", label: "Most in stock", sortBy: "stock", order: "desc" },
];

/**
 * Raw, unvalidated search params as Next.js delivers them to a page: every
 * value is a string, an array of strings (repeated key), or absent.
 */
export type CatalogSearchParamsInput = Record<
  string,
  string | string[] | undefined
>;

/** Normalized, clamped catalog parameters. */
export interface CatalogParams {
  /** 1-based page number. */
  page: number;
  /** Page size, clamped to `CATALOG_MIN_LIMIT`-`CATALOG_MAX_LIMIT`. */
  limit: number;
  /** Category slug filter, when present and non-blank. */
  category?: string;
  /** Full-text search query, when present and non-blank. */
  q?: string;
  /** Allowlisted sort field, when present and valid. */
  sortBy?: CatalogSortField;
  /** Sort direction; always defined. */
  order: SortOrder;
}

/** Collapse a possibly-repeated query value to its first entry. */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.length > 0 ? value[0] : undefined;
  return value;
}

/** Parse a trimmed decimal string into a truncated integer, or `undefined`. */
function toInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.trunc(parsed);
}

/** Normalize free text: trim, collapsing blank input to `undefined`. */
function toText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Clamp a page number to an integer greater than or equal to 1. */
export function clampCatalogPage(page: number): number {
  if (!Number.isFinite(page)) return CATALOG_DEFAULT_PAGE;
  return Math.max(CATALOG_DEFAULT_PAGE, Math.trunc(page));
}

/** Clamp a page size to an integer within the supported range. */
export function clampCatalogLimit(limit: number): number {
  if (!Number.isFinite(limit)) return CATALOG_DEFAULT_LIMIT;
  return Math.min(
    CATALOG_MAX_LIMIT,
    Math.max(CATALOG_MIN_LIMIT, Math.trunc(limit)),
  );
}

/** Type guard for the sortBy allowlist. */
export function isCatalogSortField(value: string): value is CatalogSortField {
  return (CATALOG_SORT_FIELDS as readonly string[]).includes(value);
}

/**
 * Validate a sort field against the allowlist; anything outside it becomes
 * `undefined` so the API returns its own natural ordering.
 */
export function normalizeCatalogSortBy(
  value: string | undefined,
): CatalogSortField | undefined {
  const text = toText(value);
  if (text === undefined) return undefined;
  return isCatalogSortField(text) ? text : undefined;
}

/** Normalize a sort direction; anything other than `desc` means `asc`. */
export function normalizeCatalogOrder(value: string | undefined): SortOrder {
  return value?.trim().toLowerCase() === "desc" ? "desc" : "asc";
}

/**
 * Parse untrusted search params into typed, clamped `CatalogParams`. Missing or
 * malformed values fall back to documented defaults rather than throwing, so a
 * hand-typed URL can never crash the listing.
 */
export function parseCatalogParams(
  input: CatalogSearchParamsInput = {},
): CatalogParams {
  const page = clampCatalogPage(
    toInteger(firstValue(input.page)) ?? CATALOG_DEFAULT_PAGE,
  );
  const limit = clampCatalogLimit(
    toInteger(firstValue(input.limit)) ?? CATALOG_DEFAULT_LIMIT,
  );
  const category = toText(firstValue(input.category));
  const q = toText(firstValue(input.q));
  const sortBy = normalizeCatalogSortBy(firstValue(input.sortBy));
  const order = normalizeCatalogOrder(firstValue(input.order));

  return { page, limit, category, q, sortBy, order };
}

/**
 * Build the DummyJSON list query for a catalog page. `skip` is derived from the
 * 1-based page. `order` is only sent when a sort field is present, because the
 * API ignores a direction without one.
 */
export function catalogToProductListParams(
  params: CatalogParams,
): ProductListParams {
  const limit = clampCatalogLimit(params.limit);
  const page = clampCatalogPage(params.page);
  const sortBy = normalizeCatalogSortBy(params.sortBy);
  return {
    limit,
    skip: (page - 1) * limit,
    sortBy,
    order: sortBy ? normalizeCatalogOrder(params.order) : undefined,
  };
}

/**
 * Serialize normalized params back into a compact search-param record, omitting
 * values equal to their defaults so URLs stay readable and round-trip through
 * `parseCatalogParams` unchanged.
 */
export function catalogToSearchParams(
  params: CatalogParams,
): Record<string, string> {
  const record: Record<string, string> = {};
  if (params.page !== CATALOG_DEFAULT_PAGE) record.page = String(params.page);
  if (params.limit !== CATALOG_DEFAULT_LIMIT) {
    record.limit = String(params.limit);
  }
  if (params.category) record.category = params.category;
  if (params.q) record.q = params.q;
  if (params.sortBy) record.sortBy = params.sortBy;
  if (params.order !== CATALOG_DEFAULT_ORDER) record.order = params.order;
  return record;
}

/** Build an href for a catalog page, e.g. `/products?page=2&sortBy=price`. */
export function buildCatalogHref(
  params: CatalogParams,
  options: { basePath?: string } = {},
): string {
  const basePath = options.basePath ?? CATALOG_BASE_PATH;
  const search = new URLSearchParams(catalogToSearchParams(params)).toString();
  return search.length > 0 ? `${basePath}?${search}` : basePath;
}

/** Root of the catalog query-key namespace. */
export const CATALOG_QUERY_KEY_ROOT = ["products", "catalog"] as const;

/**
 * Stable TanStack Query key for a normalized catalog page. `null` is used in
 * place of `undefined` for absent optional fields so the serialized key is
 * structurally identical across renders and cache hits.
 */
export function catalogQueryKey(params: CatalogParams) {
  return [
    ...CATALOG_QUERY_KEY_ROOT,
    {
      page: params.page,
      limit: params.limit,
      category: params.category ?? null,
      q: params.q ?? null,
      sortBy: params.sortBy ?? null,
      order: params.order,
    },
  ] as const;
}
