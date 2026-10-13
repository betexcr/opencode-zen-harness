import { useQuery } from "@tanstack/react-query";

import type { Product } from "@/lib/api/schemas";

import { productQueryOptions } from "./product-detail";

/**
 * Client hook for a single product detail page.
 *
 * Thin wrapper over `productQueryOptions`, matching the `use-featured-products`
 * convention. `initialData` lets the server pass a validated record so the first
 * client render matches the static shell; when absent the client fetches the
 * same product and the component renders its loading/empty/error states.
 */
export function useProduct(id: number, initialData?: Product) {
  return useQuery({
    ...productQueryOptions(id),
    initialData,
  });
}
