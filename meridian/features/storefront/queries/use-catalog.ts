import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { ProductListResponse } from "@/lib/api/schemas";

import {
  catalogCategoriesQueryOptions,
  catalogQueryOptions,
} from "./catalog";
import { parseCatalogParams, type CatalogSearchParamsInput } from "./catalog-params";

/**
 * Client hooks for the catalog listing.
 *
 * Mirrors the `use-featured-products` convention: the hooks are thin wrappers
 * over the `queryOptions()` factories in `./catalog`, so the server seed and the
 * client cache share one key and one fetcher. `initialData` lets a server
 * component pass an already-validated first page so the first client render
 * matches the static shell.
 */

/**
 * Client hook for a catalog page. Accepts either a URL-shaped search-param
 * object (validated here via `parseCatalogParams`) or an already-normalized
 * `CatalogParams` value.
 */
export function useCatalog(
  input: CatalogSearchParamsInput | ReturnType<typeof parseCatalogParams>,
  initialData?: ProductListResponse,
) {
  const params =
    "page" in input && typeof input.page === "number"
      ? (input as ReturnType<typeof parseCatalogParams>)
      : parseCatalogParams(input as CatalogSearchParamsInput);

  return useQuery({
    ...catalogQueryOptions(params),
    initialData,
  });
}

/** Client hook for the catalogue category list (sidebar/dropdown). */
export function useCatalogCategories() {
  return useQuery(catalogCategoriesQueryOptions());
}

/**
 * Best-effort server prefetch for a catalog page.
 *
 * Intended for route handlers/server components that want to warm the query
 * cache before handing off to `useCatalog`. Failures are swallowed so a cold
 * upstream never blocks rendering; the client hook then owns the request and its
 * loading/error lifecycle.
 */
export async function prefetchCatalogPage(
  queryClient: QueryClient,
  input: CatalogSearchParamsInput,
): Promise<void> {
  const params = parseCatalogParams(input);
  try {
    await queryClient.prefetchQuery(catalogQueryOptions(params));
  } catch {
    /* ignore: the client hook retries via its own query */
  }
}
