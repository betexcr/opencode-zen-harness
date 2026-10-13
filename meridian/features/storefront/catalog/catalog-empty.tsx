"use client";

import { Button } from "@/components/ui/button";

export interface CatalogEmptyProps {
  hasFilters?: boolean;
  onClearFilters?: () => void;
  isFetching?: boolean;
}

/**
 * Distinguishable empty state for the catalogue.
 *
 * Two variants: no results for the active filters (offers a clear action) and
 * an empty catalogue. A real role=status region so assistive technology
 * announces the outcome of a search or filter change.
 */
export function CatalogEmpty({
  hasFilters = false,
  onClearFilters,
  isFetching = false,
}: CatalogEmptyProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-surface-muted p-8"
    >
      <h3 className="text-lg font-medium">
        {hasFilters ? "No products match your filters." : "No products found."}
      </h3>
      <p className="text-sm text-muted-foreground">
        {hasFilters
          ? "Try adjusting your search, category, or sorting."
          : "There are no products to display for this view."}
      </p>
      {hasFilters && onClearFilters ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={onClearFilters}
        >
          {isFetching ? "Clearing\u2026" : "Clear filters"}
        </Button>
      ) : null}
    </div>
  );
}