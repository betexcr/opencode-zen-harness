import { queryOptions } from "@tanstack/react-query";

import {
  getProductCategories,
  getProducts,
  getProductsByCategory,
  searchProducts,
} from "@/lib/api/products";

import {
  catalogQueryKey,
  catalogToProductListParams,
  CATALOG_QUERY_KEY_ROOT,
  type CatalogParams,
} from "./catalog-params";

/**
 * Re-export the canonical catalogue base path (`CATALOG_BASE_PATH`) so callers
 * and tests can import it alongside `fetchCatalogPage`, with a single source of
 * truth remaining in `catalog-params`.
 */
export { CATALOG_BASE_PATH } from "./catalog-params";

/**
 * Server/client query definitions for the catalog listing.
 *
 * This is the same convention as `featured-products.ts`: a pure
 * `queryOptions()` factory that both the client hook (`use-catalog.ts`) and any
 * server-side prefetching share, so there is exactly one definition of the
 * request, its key, and its caching policy.
 *
 * The source of truth for the listing depends on the normalized params:
 * a `q` search term routes to `GET /products/search`, a `category` routes to
 * `GET /products/category/{slug}`, and otherwise the generic `GET /products`
 * endpoint is used with sort/pagination. All three still go through the typed
 * client in `lib/api`; this module never calls `fetch`.
 */

/** Fetch the catalog page described by normalized params. */
export function fetchCatalogPage(params: CatalogParams) {
  const listParams = catalogToProductListParams(params);
  if (params.q) {
    return searchProducts(params.q, listParams);
  }
  if (params.category) {
    return getProductsByCategory(params.category, listParams);
  }
  return getProducts(listParams);
}

/**
 * TanStack Query options for a catalog page. The key is derived from the
 * normalized params so paging, filtering, and sorting each get a distinct,
 * stable cache entry.
 */
export function catalogQueryOptions(params: CatalogParams) {
  return queryOptions({
    queryKey: catalogQueryKey(params),
    queryFn: ({ signal }) => {
      const listParams = catalogToProductListParams(params);
      if (params.q) {
        return searchProducts(params.q, listParams, { signal });
      }
      if (params.category) {
        return getProductsByCategory(params.category, listParams, { signal });
      }
      return getProducts(listParams, { signal });
    },
    staleTime: 60_000,
  });
}

/**
 * Stable key for the category list. Static (no parameters) because the category
 * taxonomy is global to the catalogue.
 */
export const CATALOG_CATEGORIES_QUERY_KEY = [
  ...CATALOG_QUERY_KEY_ROOT,
  "categories",
] as const;

/**
 * TanStack Query options for the category list used by the catalog's category
 * sidebar/dropdown. Uses `GET /products/categories`, returning the typed
 * `{ slug, name, url }` records.
 */
export function catalogCategoriesQueryOptions() {
  return queryOptions({
    queryKey: CATALOG_CATEGORIES_QUERY_KEY,
    queryFn: ({ signal }) => getProductCategories({ signal }),
    staleTime: 5 * 60_000,
  });
}
