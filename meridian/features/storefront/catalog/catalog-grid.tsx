"use client";

import { Button } from "@/components/ui/button";
import { toErrorMessage } from "@/lib/api/client";
import type { ProductListResponse } from "@/lib/api/schemas";

import { ProductCard } from "@/features/storefront/components/product-card";
import { ProductGridSkeleton } from "@/features/storefront/components/product-grid-skeleton";

import { CatalogEmpty } from "./catalog-empty";

/**
 * Catalogue results grid.
 *
 * Presentation only: renders the three distinct result states (loading, error,
 * empty) plus the populated grid, driven entirely by the query flags passed in
 * by the catalogue container. The column rhythm matches ProductGridSkeleton so
 * there is no layout shift between loading and loaded states.
 */
export interface CatalogGridProps {
  data?: ProductListResponse | null;
  isPending: boolean;
  isError: boolean;
  error?: unknown;
  isFetching?: boolean;
  hasFilters?: boolean;
  onClearFilters?: () => void;
  onRetry?: () => void;
}

const GRID_CLASSES =
  "grid list-none grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4";

export function CatalogGrid({
  data,
  isPending,
  isError,
  error,
  isFetching = false,
  hasFilters = false,
  onClearFilters,
  onRetry,
}: CatalogGridProps) {
  const products = data?.products ?? [];

  if (isPending) {
    return (
      <div aria-busy="true">
        <span role="status" className="sr-only">
          Loading products
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
          We couldn&apos;t load products.
        </h3>
        <p className="text-sm text-muted-foreground">
          {toErrorMessage(error)}
        </p>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={onRetry}
          >
            {isFetching ? "Retrying\u2026" : "Try again"}
          </Button>
        ) : null}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <CatalogEmpty
        hasFilters={hasFilters}
        onClearFilters={onClearFilters}
        isFetching={isFetching}
      />
    );
  }

  return (
    <div aria-busy={isFetching}>
      {isFetching ? (
        <p role="status" className="sr-only">
          Updating products
        </p>
      ) : null}
      <ul className={GRID_CLASSES}>
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </div>
  );
}