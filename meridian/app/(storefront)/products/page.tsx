import { Suspense } from "react";

import type { Metadata } from "next";

import { Skeleton } from "@/components/ui/skeleton";
import { CatalogGrid } from "@/features/storefront/catalog/catalog-grid";
import { CatalogPagination } from "@/features/storefront/catalog/pagination";
import { CatalogToolbar } from "@/features/storefront/catalog/catalog-toolbar";
import { CategoryFilter } from "@/features/storefront/catalog/category-filter";
import { ProductGridSkeleton } from "@/features/storefront/components/product-grid-skeleton";
import { fetchCatalogPage } from "@/features/storefront/queries/catalog";
import {
  CATALOG_BASE_PATH,
  parseCatalogParams,
  type CatalogParams,
  type CatalogSearchParamsInput,
} from "@/features/storefront/queries/catalog-params";
import { getProductCategories } from "@/lib/api/products";
import type {
  ProductCategoryList,
  ProductListResponse,
} from "@/lib/api/schemas";

/**
 * Catalogue listing route.
 *
 * A SERVER component by design. It treats the URL as the single source of truth:
 * untrusted `searchParams` are validated and clamped by the pure task-1 parser
 * (`parseCatalogParams`), the matching page is fetched on the server through the
 * task-3 data function (`fetchCatalogPage`, which routes `q` -> search,
 * `category` -> category, otherwise the generic list endpoint), and the resolved
 * page/limit/total/category/query values are handed to the task-3 presentation
 * components. No `window`/`localStorage` is touched here; the interactive
 * controls are client components that rewrite the URL and let the server
 * re-render.
 *
 * Cache Components note: `searchParams` is request-time data, so it is read
 * *inside* a `<Suspense>` boundary (`CatalogBrowser`). That keeps the editorial
 * header as a prerenderable static shell and streams the results region, rather
 * than blocking the whole route. The nested boundaries also wrap the client
 * controls that call `useSearchParams`, as Cache Components requires.
 */

export const metadata: Metadata = {
  title: "Browse the catalogue",
  description:
    "Filter, search, and sort the full Meridian catalogue, drawn live from the sample API.",
};

/** Grid loading state, identical in rhythm to the home route's fallback. */
function CatalogGridFallback() {
  return (
    <div>
      <span role="status" className="sr-only">
        Loading products
      </span>
      <ProductGridSkeleton />
    </div>
  );
}

/** Category selector placeholder shown while the taxonomy is fetched. */
function CategoryFilterFallback() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

/** Toolbar placeholder shown while the results region streams in. */
function CatalogToolbarFallback() {
  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      aria-hidden="true"
    >
      <Skeleton className="h-9 w-full sm:max-w-sm" />
      <Skeleton className="h-9 w-full sm:w-[220px]" />
    </div>
  );
}

/**
 * Static-shell fallback for the whole results region, shown until the
 * request-time `searchParams` resolve and the browser starts streaming.
 */
function CatalogBrowserFallback() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
      <aside aria-label="Catalogue filters">
        <CategoryFilterFallback />
      </aside>
      <div className="flex flex-col gap-6">
        <CatalogToolbarFallback />
        <CatalogGridFallback />
      </div>
    </div>
  );
}

/**
 * Server-fetched category taxonomy for the filter. A failed category fetch is
 * non-fatal: the filter degrades to "All categories" rather than breaking the
 * listing.
 */
async function CatalogCategoryFilter({ category }: { category?: string }) {
  const categories: ProductCategoryList = await getProductCategories().catch(
    () => [] as ProductCategoryList,
  );

  return (
    <CategoryFilter
      categories={categories}
      currentCategory={category ?? null}
    />
  );
}

/**
 * Server-fetched results for the normalized catalog params. On upstream failure
 * the grid renders its own error state; otherwise it renders the populated grid
 * and, when there are results, URL-driven pagination.
 */
async function CatalogResults({ params }: { params: CatalogParams }) {
  let data: ProductListResponse;
  try {
    data = await fetchCatalogPage(params);
  } catch {
    return <CatalogGrid isPending={false} isError isFetching={false} />;
  }

  return (
    <>
      <CatalogGrid
        data={data}
        isPending={false}
        isError={false}
        isFetching={false}
      />
      {data.products.length > 0 ? (
        <CatalogPagination
          page={params.page}
          total={data.total}
          limit={data.limit > 0 ? data.limit : params.limit}
          basePath={CATALOG_BASE_PATH}
        />
      ) : null}
    </>
  );
}

/**
 * Request-time browser region. Reading `searchParams` here (behind Suspense)
 * opts only this subtree into dynamic rendering and keeps the surrounding page
 * a static shell.
 */
async function CatalogBrowser({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParamsInput>;
}) {
  const params = parseCatalogParams(await searchParams);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
      <aside aria-label="Catalogue filters">
        <Suspense fallback={<CategoryFilterFallback />}>
          <CatalogCategoryFilter category={params.category} />
        </Suspense>
      </aside>

      <div className="flex flex-col gap-6">
        <Suspense fallback={<CatalogToolbarFallback />}>
          <CatalogToolbar
            sortBy={params.sortBy}
            order={params.order}
            q={params.q}
          />
        </Suspense>

        <Suspense fallback={<CatalogGridFallback />}>
          <CatalogResults params={params} />
        </Suspense>
      </div>
    </div>
  );
}

export default function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParamsInput>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[var(--container-editorial)] flex-1 flex-col px-4 py-12 sm:px-6 sm:py-16">
      <header className="border-b border-border pb-8">
        <p className="meridian-overline">Catalogue</p>
        <h1 className="mt-3 text-display-sm font-semibold text-balance">
          Browse the catalogue
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-lg text-muted-foreground">
          Filter, search, and sort the full Meridian edit. Every page is drawn
          live from the sample API and validated at the edge of the data layer.
        </p>
      </header>

      <Suspense fallback={<CatalogBrowserFallback />}>
        <CatalogBrowser searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
