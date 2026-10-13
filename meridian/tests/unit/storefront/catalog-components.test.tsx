import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogEmpty } from "@/features/storefront/catalog/catalog-empty";
import { CatalogGrid } from "@/features/storefront/catalog/catalog-grid";
import { CatalogPagination } from "@/features/storefront/catalog/pagination";
import { CatalogToolbar } from "@/features/storefront/catalog/catalog-toolbar";
import { CategoryFilter } from "@/features/storefront/catalog/category-filter";
import type { Product, ProductListResponse } from "@/lib/api/schemas";

const pushMock = vi.fn();
const replaceMock = vi.fn();
const searchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
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

function makeList(products: Product[]): ProductListResponse {
  return { products, total: products.length, skip: 0, limit: 12 };
}

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("CatalogEmpty", () => {
  it("renders the empty-catalogue variant without a clear action", () => {
    render(<CatalogEmpty />);
    expect(screen.getByText("No products found.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the filtered variant and clears filters on click", async () => {
    const onClearFilters = vi.fn();
    const user = userEvent.setup();
    render(<CatalogEmpty hasFilters onClearFilters={onClearFilters} />);

    expect(
      screen.getByText("No products match your filters."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("disables the clear action while a fetch is in flight", () => {
    render(
      <CatalogEmpty hasFilters onClearFilters={() => {}} isFetching />,
    );
    expect(screen.getByRole("button", { name: "Clearing…" })).toBeDisabled();
  });
});

describe("CatalogGrid", () => {
  it("shows a distinct loading state (skeleton) while pending", () => {
    renderWithQuery(<CatalogGrid isPending isError={false} />);
    expect(screen.getByText("Loading products")).toBeInTheDocument();
  });

  it("shows a distinct error state with the normalized message", () => {
    renderWithQuery(
      <CatalogGrid isPending={false} isError error={new Error("boom")} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /We couldn.t load products\./,
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("offers a retry action in the error state when provided", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <CatalogGrid isPending={false} isError onRetry={onRetry} />,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders products through ProductCard", () => {
    renderWithQuery(
      <CatalogGrid
        isPending={false}
        isError={false}
        data={makeList([makeProduct(1, "Aurora Lamp")])}
      />,
    );
    expect(screen.getByText("Aurora Lamp")).toBeInTheDocument();
  });

  it("shows the empty state distinctly when the page has no products", () => {
    renderWithQuery(
      <CatalogGrid isPending={false} isError={false} data={makeList([])} />,
    );
    expect(screen.getByText("No products found.")).toBeInTheDocument();
  });
});

describe("CatalogPagination", () => {
  beforeEach(() => {
    searchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("disables Previous on the first page and links to the next page", () => {
    render(<CatalogPagination page={1} total={24} limit={12} basePath="/products" />);

    const prev = screen.getByRole("link", { name: "Previous page" });
    expect(prev).toHaveAttribute("aria-disabled", "true");

    const next = screen.getByRole("link", { name: "Next page" });
    expect(next).toHaveAttribute("aria-disabled", "false");
    expect(next).toHaveAttribute("href", "/products?page=2");
    expect(screen.getByText(/Showing 1-12 of 24/)).toBeInTheDocument();
  });

  it("disables Next on the last page", () => {
    render(<CatalogPagination page={2} total={24} limit={12} basePath="/products" />);

    const next = screen.getByRole("link", { name: "Next page" });
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("preserves active filters via buildHref", () => {
    const buildHref = vi.fn(
      (page: number) => `/products?category=laptops&page=${page}`,
    );
    render(
      <CatalogPagination
        page={2}
        total={24}
        limit={12}
        basePath="/products"
        buildHref={buildHref}
      />,
    );

    const prev = screen.getByRole("link", { name: "Previous page" });
    expect(prev).toHaveAttribute(
      "href",
      "/products?category=laptops&page=1",
    );
    expect(buildHref).toHaveBeenCalledWith(1);
  });

  it("preserves the active query string when no buildHref is supplied", () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams("q=lamp&category=test&page=2"),
    );
    render(
      <CatalogPagination page={2} total={24} limit={12} basePath="/products" />,
    );

    const prev = screen.getByRole("link", { name: "Previous page" });
    expect(prev).toHaveAttribute("href", "/products?q=lamp&category=test");

    const next = screen.getByRole("link", { name: "Next page" });
    expect(next).toHaveAttribute(
      "href",
      "/products?q=lamp&category=test&page=3",
    );
  });
});

describe("CategoryFilter", () => {
  beforeEach(() => {
    pushMock.mockClear();
    searchParamsMock.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes the selected category slug into the URL and resets page", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("page=3"));
    const user = userEvent.setup();
    render(
      <CategoryFilter
        categories={[{ slug: "laptops", name: "Laptops", url: "" }]}
      />,
    );

    await user.click(
      screen.getByRole("combobox", { name: "Filter by category" }),
    );
    await user.click(await screen.findByRole("option", { name: "Laptops" }));

    expect(pushMock).toHaveBeenCalledWith("?category=laptops");
  });

  it("clears the category param when choosing All categories", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("category=laptops"));
    const user = userEvent.setup();
    render(
      <CategoryFilter
        categories={[{ slug: "laptops", name: "Laptops", url: "" }]}
        currentCategory="laptops"
      />,
    );

    await user.click(
      screen.getByRole("combobox", { name: "Filter by category" }),
    );
    await user.click(await screen.findByRole("option", { name: "All categories" }));

    expect(pushMock).toHaveBeenCalledWith("?");
  });
});

describe("CatalogToolbar", () => {
  beforeEach(() => {
    searchParamsMock.mockReturnValue(new URLSearchParams());
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes the trimmed search term into the URL and resets page", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("page=4"));
    const user = userEvent.setup();
    render(<CatalogToolbar q="" />);

    await user.type(
      screen.getByRole("searchbox", { name: "Search products" }),
      "  phone  ",
    );
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(pushMock).toHaveBeenCalledWith("?q=phone");
  });

  it("maps a sort choice onto sortBy/order search params", async () => {
    const user = userEvent.setup();
    render(<CatalogToolbar />);

    await user.click(screen.getByRole("combobox", { name: "Sort products" }));
    await user.click(
      await screen.findByRole("option", { name: "Price: High to low" }),
    );

    expect(pushMock).toHaveBeenCalledWith("?sortBy=price&order=desc");
  });

  it("removes sortBy/order when the default sort is chosen", async () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams("sortBy=price&order=desc"),
    );
    const user = userEvent.setup();
    render(<CatalogToolbar sortBy="price" order="desc" />);

    await user.click(screen.getByRole("combobox", { name: "Sort products" }));
    await user.click(await screen.findByRole("option", { name: "Default" }));

    expect(pushMock).toHaveBeenCalledWith("?");
  });
});
