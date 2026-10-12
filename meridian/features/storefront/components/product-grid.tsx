"use client";

import { Button } from "@/components/ui/button";
import { toErrorMessage } from "@/lib/api/client";
import type { ProductListResponse } from "@/lib/api/schemas";

import { useFeaturedProducts } from "../queries/use-featured-products";
import { ProductCard } from "./product-card";
import { ProductGridSkeleton } from "./product-grid-skeleton";

/**
 * Featured product grid.
 *
 * Client-side by design: TanStack Query owns the request lifecycle so loading,
 * empty, error, and retry are all real, interactive states rather than static
 * markup. Data flows through the typed, Zod-validated query functions in
 * `lib/api`; the component never calls `fetch` directly.
 *
 * `initialData` is the optional Cache Components seed the server renders into
 * the static shell. When it is present the first client render matches the
 * server; when it is absent (e.g. the seed could not be produced) the query
 * fetches the same edit and shows the skeleton until it resolves.
 */
export function ProductGrid({
  initialData,
}: {
  initialData?: ProductListResponse;
}) {
  const { data, isPending, isError, error, refetch, isFetching } =
    useFeaturedProducts(initialData);
  const products = data?.products ?? [];

  if (isPending) {
    return (
      <div>
        <span role="status" className="sr-only">
          Loading featured products
        </span>
        <ProductGridSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface-muted p-8"
      >
        <h3 className="text-lg font-medium">
          We couldn&apos;t load the featured products.
        </h3>
        <p className="text-sm text-muted-foreground">
          {toErrorMessage(error)}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={isFetching}
          onClick={() => {
            void refetch();
          }}
        >
          {isFetching ? "Retrying…" : "Try again"}
        </Button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-surface-muted p-8"
      >
        <h3 className="text-lg font-medium">No featured products right now.</h3>
        <p className="text-sm text-muted-foreground">
          The catalogue returned an empty edit. Refresh to check again.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={isFetching}
          onClick={() => {
            void refetch();
          }}
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
    );
  }

  return (
    <ul className="grid list-none grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
