import { queryOptions } from "@tanstack/react-query";

import { getProduct } from "@/lib/api/products";
import type { Product } from "@/lib/api/schemas";

/**
 * Query definition for a single product detail page.
 *
 * Same convention as `featured-products.ts`: one pure `queryOptions()` factory
 * shared by the client hook (`use-product.ts`) and any server seeding, so the
 * request, its key, and its caching policy live in exactly one place. The fetch
 * goes through the typed client in `lib/api`; no raw `fetch` here.
 */

/** Root of the product-detail query-key namespace. */
export const PRODUCT_QUERY_KEY_ROOT = ["products", "detail"] as const;

/** Stable TanStack Query key for a single product. */
export function productQueryKey(id: number) {
  return [...PRODUCT_QUERY_KEY_ROOT, id] as const;
}

/**
 * TanStack Query options for one product. Products change slowly in the sample
 * catalogue, so the entry is kept fresh for a few minutes.
 */
export function productQueryOptions(id: number) {
  return queryOptions({
    queryKey: productQueryKey(id),
    queryFn: ({ signal }) => getProduct(id, { signal }),
    staleTime: 5 * 60_000,
  });
}

/**
 * Server-side seed for the product detail route.
 *
 * Best-effort like `getFeaturedProducts`: on any failure (unknown id, upstream
 * error, malformed payload) it resolves to `null` so the page still renders and
 * the client hook becomes the source of truth.
 */
export async function getProductDetail(id: number): Promise<Product | null> {
  try {
    return await getProduct(id);
  } catch {
    return null;
  }
}
