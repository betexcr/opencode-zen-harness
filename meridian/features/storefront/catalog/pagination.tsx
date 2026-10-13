"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * URL-driven catalogue pagination.
 *
 * Pages are expressed through the page search param so the server-driven list
 * stays the source of truth. Prev/Next are real anchors. When the caller
 * supplies `buildHref` its hrefs are used verbatim; otherwise the component
 * derives hrefs from the live query string so the active filter/search params
 * are preserved and only `page` changes. Both controls are disabled at their
 * bounds via aria-disabled.
 */
export interface CatalogPaginationProps {
  page: number;
  total: number;
  limit: number;
  /** Base path used when buildHref is not supplied. */
  basePath: string;
  /** Builds an href for a 1-based target page, preserving active filters. */
  buildHref?: (page: number) => string;
}

export function CatalogPagination({
  page,
  total,
  limit,
  basePath,
  buildHref,
}: CatalogPaginationProps) {
  const safeLimit = limit > 0 ? limit : 1;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const current = Math.min(Math.max(1, page), totalPages);
  const hasPrev = current > 1;
  const hasNext = current < totalPages;
  const start = total === 0 ? 0 : (current - 1) * safeLimit + 1;
  const end = Math.min(current * safeLimit, total);

  const searchParams = useSearchParams();
  const resolveHref =
    buildHref ??
    ((target: number) => {
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      if (target <= 1) {
        next.delete("page");
      } else {
        next.set("page", String(target));
      }
      const queryString = next.toString();
      return queryString.length > 0 ? `${basePath}?${queryString}` : basePath;
    });

  function linkClass(disabled: boolean): string {
    return cn(
      buttonVariants({ variant: "outline", size: "sm" }),
      disabled && "pointer-events-none opacity-50",
    );
  }

  return (
    <nav
      aria-label="Catalog pagination"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        Showing {start}-{end} of {total} products
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={resolveHref(current - 1)}
          aria-label="Previous page"
          aria-disabled={!hasPrev}
          tabIndex={hasPrev ? undefined : -1}
          onClick={(event) => {
            if (!hasPrev) event.preventDefault();
          }}
          className={linkClass(!hasPrev)}
        >
          Previous
        </Link>
        <span
          className="min-w-16 text-center text-sm tabular-nums"
          aria-live="polite"
        >
          Page {current} of {totalPages}
        </span>
        <Link
          href={resolveHref(current + 1)}
          aria-label="Next page"
          aria-disabled={!hasNext}
          tabIndex={hasNext ? undefined : -1}
          onClick={(event) => {
            if (!hasNext) event.preventDefault();
          }}
          className={linkClass(!hasNext)}
        >
          Next
        </Link>
      </div>
    </nav>
  );
}