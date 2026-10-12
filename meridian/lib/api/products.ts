import { request, type RequestOptions } from "./client";
import {
  categoryListSchema,
  productCategoriesSchema,
  productListResponseSchema,
  productSchema,
  type CategoryList,
  type Product,
  type ProductCategoryList,
  type ProductListResponse,
} from "./schemas";

/**
 * Products API surface for DummyJSON.
 *
 * All responses are validated with Zod; malformed or truncated payloads raise a
 * typed `ApiError(kind: "parse")` from the client.
 */

export type SortOrder = "asc" | "desc";

/** Query keys `select` accepts either a comma-joined string or a field array. */
export type SelectFields = string | readonly string[];

export interface ProductListParams {
  /** Maximum number of records to return. */
  limit?: number;
  /** Number of records to skip (offset). */
  skip?: number;
  /** Restrict the returned fields to keep payloads small. */
  select?: SelectFields;
  /** Field to sort by (e.g. `price`, `rating`, `title`). */
  sortBy?: string;
  /** Sort direction; DummyJSON accepts `asc` or `desc`. */
  order?: SortOrder;
}

function normalizeSelect(select?: SelectFields): string | undefined {
  if (select === undefined) return undefined;
  if (typeof select === "string") {
    const trimmed = select.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  const fields = select.filter((field) => field.trim().length > 0);
  return fields.length > 0 ? fields.join(",") : undefined;
}

/** Convert validated list params into a query record, dropping empty values. */
export function toListQuery(
  params: ProductListParams = {},
): NonNullable<RequestOptions["query"]> {
  return {
    limit: params.limit,
    skip: params.skip,
    select: normalizeSelect(params.select),
    sortBy: params.sortBy,
    order: params.order,
  };
}

/** `GET /products` — paginated, sortable, field-selectable product list. */
export function getProducts(
  params: ProductListParams = {},
  options?: { signal?: AbortSignal; baseUrl?: string },
): Promise<ProductListResponse> {
  return request("/products", {
    query: toListQuery(params),
    schema: productListResponseSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}

/** `GET /products/{id}` — a single product. Unknown ids produce a 404 `ApiError`. */
export function getProduct(
  id: number,
  options?: { select?: SelectFields; signal?: AbortSignal; baseUrl?: string },
): Promise<Product> {
  return request(`/products/${encodeURIComponent(String(id))}`, {
    query: { select: normalizeSelect(options?.select) },
    schema: productSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}

/** `GET /products/search?q=` — full-text product search with list options. */
export function searchProducts(
  query: string,
  params: ProductListParams = {},
  options?: { signal?: AbortSignal; baseUrl?: string },
): Promise<ProductListResponse> {
  return request("/products/search", {
    query: { q: query.trim(), ...toListQuery(params) },
    schema: productListResponseSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}

/** `GET /products/categories` — a bare array of {slug,name,url}. */
export function getProductCategories(options?: {
  signal?: AbortSignal;
  baseUrl?: string;
}): Promise<ProductCategoryList> {
  return request("/products/categories", {
    schema: productCategoriesSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}

/** `GET /products/category-list` — a bare array of category slug strings. */
export function getProductCategoryList(options?: {
  signal?: AbortSignal;
  baseUrl?: string;
}): Promise<CategoryList> {
  return request("/products/category-list", {
    schema: categoryListSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}

/** `GET /products/category/{slug}` — paginated products within one category. */
export function getProductsByCategory(
  slug: string,
  params: ProductListParams = {},
  options?: { signal?: AbortSignal; baseUrl?: string },
): Promise<ProductListResponse> {
  return request(`/products/category/${encodeURIComponent(slug)}`, {
    query: toListQuery(params),
    schema: productListResponseSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}

export interface ProductFilterParams {
  /** Product field to filter on. Required — DummyJSON rejects a missing key. */
  key: string;
  /** Value to match. Required — DummyJSON rejects a missing value. */
  value: string | number | boolean;
  limit?: number;
  skip?: number;
  select?: SelectFields;
}

/**
 * `GET /products/filter?key=&value=` — filter products on a single field.
 *
 * LIMITATION (documented per the verified contract): DummyJSON accepts exactly
 * ONE `key`/`value` pair per request and BOTH are required; filtering by a
 * product field only. Any multi-criteria filtering (e.g. category AND price AND
 * rating) that the API cannot express MUST be performed client-side over a
 * fetched set — never by issuing fabricated multi-key requests here.
 */
export function filterProducts(
  params: ProductFilterParams,
  options?: { signal?: AbortSignal; baseUrl?: string },
): Promise<ProductListResponse> {
  return request("/products/filter", {
    query: {
      key: params.key,
      value: params.value,
      limit: params.limit,
      skip: params.skip,
      select: normalizeSelect(params.select),
    },
    schema: productListResponseSchema,
    signal: options?.signal,
    baseUrl: options?.baseUrl,
  });
}
