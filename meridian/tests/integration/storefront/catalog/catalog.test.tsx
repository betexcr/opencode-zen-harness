import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogGrid } from "@/features/storefront/catalog/catalog-grid";
import { CatalogPagination } from "@/features/storefront/catalog/pagination";
import { CatalogToolbar } from "@/features/storefront/catalog/catalog-toolbar";
import { CategoryFilter } from "@/features/storefront/catalog/category-filter";
import {
  buildCatalogHref,
  parseCatalogParams,
  type CatalogSearchParamsInput,
} from "@/features/storefront/queries/catalog-params";
import { useCatalog } from "@/features/storefront/queries/use-catalog";
import type { Product, ProductListResponse } from "@/lib/api/schemas";

/**
 * Integration coverage for the server-driven catalog listing.
 *
 * These tests exercise the real wiring a page uses: the URL search params are
 * parsed by `parseCatalogParams`, the typed `useCatalog` query fetches through
 * the API client (mocked `fetch`), and the presentation components
 * (toolbar/filter/grid/pagination) render that data and write only to the URL
 * via the router. This is deliberately broader than the isolated unit tests in
 * `tests/unit/storefront/catalog-components.test.tsx`.
 */

const pushMock = vi.fn();
const replaceMock = vi.fn();
const searchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => "/products",
  useSearchParams: () => searchParamsMock(),
}));

const CATEGORIES = [
  { slug: "laptops", name: "Laptops", url: "" },
  { slug: "fragrances", name: "Fragrances", url: "" },
];

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
 * Composes the pieces exactly as the `(storefront)/products` route does:
 * one normalized param set drives the query, the controls, the grid, and the
 * pagination hrefs.
 */
function CatalogPage({
  searchParams,
}: {
  searchParams: CatalogSearchParamsInput;
}) {
  const params = parseCatalogParams(searchParams);
  const { data, isPending, isError, error, isFetching, refetch } =
    useCatalog(params);

  return (
    <>
      <CatalogToolbar
        sortBy={params.sortBy}
        order={params.order}
        q={params.q}
        isFetching={isFetching}
      />
      <CategoryFilter
        categories={CATEGORIES}
        currentCategory={params.category ?? null}
      />
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
    </>
  );
}

describe("catalog listing integration", () => {
  beforeEach(() => {
    pushMock.mockClear();
    replaceMock.mockClear();
    searchParamsMock.mockReset();
    searchParamsMock.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows the skeleton, then the first page of products with bounds-aware pagination", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeResponse(
          makeList(
            [makeProduct(1, "Aurora Lamp"), makeProduct(2, "Vellum Chair")],
            24,
          ),
        ),
      ),
    );

    renderWithQuery(<CatalogPage searchParams={{}} />);

    expect(screen.getByText("Loading products")).toBeInTheDocument();

    expect(await screen.findByText("Aurora Lamp")).toBeInTheDocument();
    expect(screen.getByText("Vellum Chair")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1-12 of 24/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Previous page" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });

  it("fetches the category endpoint when a category is active", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      makeResponse(makeList([makeProduct(3, "ThinkPad")], 1)),
    );
    vi.stubGlobal("fetch", fetchMock);
    searchParamsMock.mockReturnValue(new URLSearchParams("category=laptops"));

    renderWithQuery(<CatalogPage searchParams={{ category: "laptops" }} />);

    expect(await screen.findByText("ThinkPad")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/products/category/laptops",
    );
  });

  it("shows a distinct error state and recovers when the shopper retries", async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(makeResponse({ message: "boom" }, 500))
      .mockResolvedValueOnce(
        makeResponse(makeList([makeProduct(9, "Recovered Table")], 1)),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<CatalogPage searchParams={{}} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /We couldn.t load products\./,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Recovered Table")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("writes the search query into the URL and preserves the active category", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => makeResponse(makeList([makeProduct(1, "Aurora Lamp")], 1))),
    );
    searchParamsMock.mockReturnValue(
      new URLSearchParams("category=laptops&page=3"),
    );

    renderWithQuery(<CatalogPage searchParams={{ category: "laptops" }} />);
    await screen.findByText("Aurora Lamp");

    const user = userEvent.setup();
    const input = screen.getByRole("searchbox", { name: "Search products" });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, "chair");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(pushMock).toHaveBeenCalledWith("?category=laptops&q=chair");
  });

  it("writes the category slug into the URL and preserves the search query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => makeResponse(makeList([makeProduct(1, "Aurora Lamp")], 1))),
    );
    searchParamsMock.mockReturnValue(new URLSearchParams("q=desk&page=2"));

    renderWithQuery(<CatalogPage searchParams={{ q: "desk" }} />);
    await screen.findByText("Aurora Lamp");

    const user = userEvent.setup();
    const combobox = screen.getByRole("combobox", {
      name: "Filter by category",
    });
    await waitFor(() => expect(combobox).toBeEnabled());
    await user.click(combobox);
    await user.click(await screen.findByRole("option", { name: "Laptops" }));

    expect(pushMock).toHaveBeenCalledWith("?q=desk&category=laptops");
  });

  it("links pagination to the next page while preserving active filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => makeResponse(makeList([makeProduct(1, "Aurora Lamp")], 24))),
    );
    searchParamsMock.mockReturnValue(new URLSearchParams("category=laptops"));

    renderWithQuery(<CatalogPage searchParams={{ category: "laptops" }} />);
    await screen.findByText("Aurora Lamp");

    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/products?page=2&category=laptops",
    );
  });
});
