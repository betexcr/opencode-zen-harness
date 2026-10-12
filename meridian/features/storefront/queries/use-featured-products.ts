import { queryOptions, useQuery } from "@tanstack/react-query";

import { getProducts, type ProductListParams } from "@/lib/api/products";
import type { ProductListResponse } from "@/lib/api/schemas";

/**
 * Featured-products query, shared by the server-cached seed and the client hook.
 *
 * The parameter set is deliberately free of `select`: the DummyJSON `Product`
 * contract is validated against a strict Zod object, so requesting a subset of
 * fields would fail validation. `sortBy=rating&order=desc` is what makes this
 * the "featured" edit — the highest-rated products in the catalogue.
 */

/** Number of featured products shown on the home grid. */
export const FEATURED_PRODUCTS_LIMIT = 8;

/** Stable query key shared by the server seed and the client cache. */
export const FEATURED_PRODUCTS_QUERY_KEY = ["products", "featured"] as const;

/** The list parameters that define the featured edit. */
export const FEATURED_PRODUCTS_PARAMS: ProductListParams = {
  limit: FEATURED_PRODUCTS_LIMIT,
  sortBy: "rating",
  order: "desc",
};

/**
 * TanStack Query options for the featured edit, derived from the typed API
 * client. Kept as a factory so the client hook and any server-side seeding use
 * exactly one definition.
 */
export function featuredProductsQueryOptions() {
  return queryOptions({
    queryKey: FEATURED_PRODUCTS_QUERY_KEY,
    queryFn: ({ signal }) => getProducts(FEATURED_PRODUCTS_PARAMS, { signal }),
    staleTime: 60_000,
  });
}

/**
 * Client hook for the featured grid.
 *
 * `initialData` lets the server pass a Cache Components seed (`getFeaturedProducts`)
 * so the first client render matches the static shell. When absent — for example
 * when the server seed is unavailable — TanStack Query performs the request and
 * the component renders its skeleton, empty, error, and retry states.
 */
export function useFeaturedProducts(initialData?: ProductListResponse) {
  return useQuery({
    ...featuredProductsQueryOptions(),
    initialData,
  });
}
