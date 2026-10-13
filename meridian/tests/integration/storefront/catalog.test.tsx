import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { useSearchParams } from "next/navigation";

import { CatalogGrid } from "@/features/storefront/catalog/catalog-grid";
import { CatalogPagination } from "@/features/storefront/catalog/pagination";
import { CatalogToolbar } from "@/features/storefront/catalog/catalog-toolbar";
import { CategoryFilter } from "@/features/storefront/catalog/category-filter";
import {
  CATALOG_BASE_PATH,
  catalogToProductListParams,
  parseCatalogParams,
} from "@/features/storefront/queries/catalog-params";
import {
  getProducts,
  getProductsByCategory,
  searchProducts,
} from "@/lib/api/products";
import type { Product, ProductListResponse } from "@/lib/api/schemas";

const pushMock = vi.fn();
const searchParamsMock = vi.fn(() => new URLSearchParams());

type FetchMock = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => "/products",
  useSearchParams: () => searchParamsMock(),
}));

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

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function CatalogHarness() {
  const searchParams = useSearchParams();
  const params = parseCatalogParams(
    Object.fromEntries(searchParams.entries()),
  );

  const query = useQuery({
    queryKey: ["catalog", params],
    queryFn: ({ signal }) => {
      const listParams = catalogToProductListParams(params);
      if (params.q) {
        return searchProducts(params.q, listParams, { signal });
      }
      if (params.category) {
        return getProductsByCategory(params.category, listParams, {
          signal,
        });
      }
      return getProducts(listParams, { signal });
    },
    retry: false,
  });

  function buildHref(target: number): string {
    const next = new URLSearchParams(searchParams.toString());
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    const queryString = next.toString();
    return queryString
      ? `${CATALOG_BASE_PATH}?${queryString}`
      : CATALOG_BASE_PATH;
  }

  return (
    <div>
      <CategoryFilter
        categories={[{ slug: "laptops", name: "Laptops", url: "" }]}
        currentCategory={params.category ?? null}
        isLoading={query.isFetching}
      />
      <CatalogToolbar
        sortBy={params.sortBy}
        order={params.order}
        q={params.q}
        isFetching={query.isFetching}
      />
      <CatalogGrid
        data={query.data}
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        isFetching={query.isFetching}
        onRetry={() => {
          void query.refetch();
        }}
      />
      {query.data ? (
        <CatalogPagination
          page={params.page}
          total={query.data.total}
          limit={query.data.limit || params.limit}
          basePath={CATALOG_BASE_PATH}
          buildHref={buildHref}
        />
      ) : null}
    </div>
  );
}

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("catalog integration", () => {
  beforeEach(() => {
    pushMock.mockClear();
    searchParamsMock.mockReturnValue(new URLSearchParams());
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders the first page from the list endpoint with pagination bounds", async () => {
    const fetchMock = vi.fn<FetchMock>(async () =>
      makeResponse(
        makeList(
          [makeProduct(1, "Aurora Lamp"), makeProduct(2, "Vellum Chair")],
          24,
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<CatalogHarness />);

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
      expect.stringContaining("/products?limit=12"),
      expect.anything(),
    );
  });

  it("routes a category param through the category endpoint", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("category=laptops"));
    const fetchMock = vi.fn<FetchMock>(async () =>
      makeResponse(makeList([makeProduct(5, "ZenBook")], 6)),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<CatalogHarness />);

    expect(await screen.findByText("ZenBook")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/products/category/laptops"),
      expect.anything(),
    );
  });

  it("shows a distinct error state and retries", async () => {
    const fetchMock = vi
      .fn<FetchMock>()
      .mockResolvedValueOnce(makeResponse({ message: "boom" }, 500))
      .mockResolvedValueOnce(
        makeResponse(makeList([makeProduct(9, "Recovered")], 1)),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<CatalogHarness />);

    expect(
      await screen.findByText(/We couldn.t load products\./),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Recovered")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("search input writes q to URL and resets page", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("category=laptops"));
    const user = userEvent.setup();
    const fetchMock = vi.fn<FetchMock>(async () =>
      makeResponse(makeList([])),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<CatalogHarness />);
    await screen.findByText("No products found.");

    const input = screen.getByRole("searchbox", { name: "Search products" });
    await user.clear(input);
    await user.type(input, "keyboard");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(pushMock).toHaveBeenCalledWith("?category=laptops&q=keyboard");
  });

  it("category filter writes slug to URL preserving other params and resets page", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("q=mouse&page=2"));
    const user = userEvent.setup();
    const fetchMock = vi.fn<FetchMock>(async () =>
      makeResponse(makeList([])),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<CatalogHarness />);
    await screen.findByText("No products found.");

    await user.click(
      screen.getByRole("combobox", { name: "Filter by category" }),
    );
    await user.click(await screen.findByRole("option", { name: "Laptops" }));

    expect(pushMock).toHaveBeenCalledWith("?q=mouse&category=laptops");
  });

  it("pagination preserves active filters and search", async () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams("q=lamp&category=test&page=2"),
    );
    const fetchMock = vi.fn<FetchMock>(async () =>
      makeResponse(makeList([makeProduct(1, "Lamp")], 24)),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<CatalogHarness />);

    expect(await screen.findByText("Lamp")).toBeInTheDocument();
    expect(screen.getByText(/Showing 13-24 of 24/)).toBeInTheDocument();
    const prev = screen.getByRole("link", { name: "Previous page" });
    expect(prev).toHaveAttribute(
      "href",
      "/products?q=lamp&category=test",
    );
  });
});
