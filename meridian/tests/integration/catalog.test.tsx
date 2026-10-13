// Integration coverage for the catalogue listing (grid, toolbar, category
// filter, pagination) driven by URL search params through TanStack Query. The
// canonical suite lives at `tests/integration/storefront/catalog.test.tsx`; it
// is surfaced here at the path the task-4 release gate filters on, plus a
// param-rendering suite that drives the real `useCatalog` hook and renders the
// results grid + pagination for each normalized parameter shape. The
// `next/navigation` mock for `useSearchParams`/`useRouter` is registered by the
// imported storefront suite, so it must NOT be re-declared here.
import "./storefront/catalog.test";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { CatalogGrid } from "@/features/storefront/catalog/catalog-grid";
import { CatalogPagination } from "@/features/storefront/catalog/pagination";
import {
  buildCatalogHref,
  parseCatalogParams,
  type CatalogSearchParamsInput,
} from "@/features/storefront/queries/catalog-params";
import { useCatalog } from "@/features/storefront/queries/use-catalog";
import type { Product, ProductListResponse } from "@/lib/api/schemas";

function makeProduct(id: number, title: string): Product {
  return {
    id,
    title,
    description: `${title} description`,
    category: "test",
    price: 100,
    discountPercentage: 0,
    rating: 4.5,
    stock: 10,
    tags: ["test"],
    brand: "Meridian",
    sku: `SKU-${id}`,
    weight: 1,
    dimensions: { width: 1, height: 1, depth: 1 },
    warrantyInformation: "1 year warranty",
    shippingInformation: "Ships in 1 day",
    availabilityStatus: "In Stock",
    reviews: [],
    returnPolicy: "30 day returns",
    minimumOrderQuantity: 1,
    images: [`https://cdn.dummyjson.com/product-images/${id}.webp`],
    thumbnail: `https://cdn.dummyjson.com/product-images/${id}.webp`,
  };
}

function makeList(
  products: Product[],
  total = products.length,
): ProductListResponse {
  return { products, total, skip: 0, limit: 12 };
}

/** Minimal duck-typed Response; the API client only reads ok/status/json. */
function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

/**
 * Result-area harness: normalizes the supplied search params exactly as the
 * route does, fetches through the typed `useCatalog` hook, and composes the
 * grid + pagination with hrefs derived from `buildCatalogHref`. The URL
 * controls (toolbar/category filter) are covered by the imported storefront
 * suite; this harness is about how each parameter shape renders results.
 */
function CatalogResults({
  initialParams,
}: {
  initialParams: CatalogSearchParamsInput;
}) {
  const params = parseCatalogParams(initialParams);
  const { data, isPending, isError, error, isFetching, refetch } =
    useCatalog(params);

  return (
    <main>
      <CatalogGrid
        data={data}
        isPending={isPending}
        isError={isError}
        error={error}
        isFetching={isFetching}
        hasFilters={Boolean(params.q || params.category || params.sortBy)}
        onRetry={() => {
          void refetch();
        }}
      />
      <CatalogPagination
        page={params.page}
        total={data?.total ?? 0}
        limit={params.limit}
        basePath="/products"
        buildHref={(page) => buildCatalogHref({ ...params, page })}
      />
    </main>
  );
}

describe("catalog param rendering integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders the default first page and links to page two", async () => {
    const fetchMock = vi.fn<() => Promise<Response>>(async () =>
      makeResponse(
        makeList(
          [makeProduct(1, "Aurora Lamp"), makeProduct(2, "Vellum Chair")],
          24,
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<CatalogResults initialParams={{}} />);

    expect(await screen.findByText("Aurora Lamp")).toBeInTheDocument();
    expect(screen.getByText("Vellum Chair")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1-12 of 24/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Previous page" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/products?page=2",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/products?limit=12&skip=0"),
      expect.anything(),
    );
  });

  it("renders page two offset and links back to the default first page", async () => {
    const fetchMock = vi.fn<() => Promise<Response>>(async () =>
      makeResponse(makeList([makeProduct(3, "ThinkPad")], 24)),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<CatalogResults initialParams={{ page: "2" }} />);

    expect(await screen.findByText("ThinkPad")).toBeInTheDocument();
    expect(screen.getByText(/Showing 13-24 of 24/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/products?limit=12&skip=12"),
      expect.anything(),
    );
  });

  it("routes a category param through the category endpoint", async () => {
    const fetchMock = vi.fn<() => Promise<Response>>(async () =>
      makeResponse(makeList([makeProduct(5, "ZenBook")], 6)),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<CatalogResults initialParams={{ category: "laptops" }} />);

    expect(await screen.findByText("ZenBook")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/products/category/laptops"),
      expect.anything(),
    );
  });

  it("gives a search query priority over the category filter", async () => {
    const fetchMock = vi.fn<() => Promise<Response>>(async () =>
      makeResponse(makeList([makeProduct(7, "Desk Lamp")], 2)),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(
      <CatalogResults initialParams={{ q: "lamp", category: "laptops" }} />,
    );

    expect(await screen.findByText("Desk Lamp")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/products/search?q=lamp"),
      expect.anything(),
    );
  });

  it("passes a valid sort field and direction to the list endpoint", async () => {
    const fetchMock = vi.fn<() => Promise<Response>>(async () =>
      makeResponse(makeList([makeProduct(8, "Sorted Chair")], 12)),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(
      <CatalogResults initialParams={{ sortBy: "price", order: "desc" }} />,
    );

    expect(await screen.findByText("Sorted Chair")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("sortBy=price"),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("order=desc"),
      expect.anything(),
    );
  });

  it("shows the empty search state when no products match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<() => Promise<Response>>(async () => makeResponse(makeList([]))),
    );

    renderWithQuery(<CatalogResults initialParams={{ q: "zzz" }} />);

    expect(
      await screen.findByText("No products match your filters."),
    ).toBeInTheDocument();
  });
});