import { cacheLife } from "next/cache";

import type { ProductListResponse } from "@/lib/api/schemas";
import { getProducts } from "@/lib/api/products";

import { FEATURED_PRODUCTS_PARAMS } from "./use-featured-products";

/**
 * Server-side, Cache Components seed for the featured edit.
 *
 * This is the "cached fetch" part of the home route: the rated edit changes
 * slowly, so the validated result is cached with `use cache` and `cacheLife`.
 * It is a best-effort seed only — on any failure (offline build, upstream
 * error, malformed payload) it returns `null` so the page still renders and the
 * client `useFeaturedProducts` query becomes the source of truth, fetching the
 * same edit with its own loading/empty/error/retry lifecycle.
 *
 * The network call still goes through the single typed client in `lib/api`; the
 * component never calls `fetch` directly.
 */
export async function getFeaturedProducts(): Promise<ProductListResponse | null> {
  "use cache";
  cacheLife("hours");

  try {
    return await getProducts(FEATURED_PRODUCTS_PARAMS);
  } catch {
    return null;
  }
}
