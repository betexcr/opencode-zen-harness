import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { ProductGrid } from "@/features/storefront/components/product-grid";
import { useHydrated } from "@/hooks/use-hydrated";
import type { Product, ProductListResponse } from "@/lib/api/schemas";
import { useCartStore } from "@/lib/state/cart-store";
import { STORAGE_KEYS } from "@/lib/state/persistence";

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
  return { products, total: products.length, skip: 0, limit: 8 };
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

describe("storefront home featured grid", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCartStore.setState({ lines: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    useCartStore.setState({ lines: [] });
  });

  it("shows a loading state, then the featured products", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeResponse(
          makeList([makeProduct(1, "Aurora Lamp"), makeProduct(2, "Vellum Chair")]),
        ),
      ),
    );

    renderWithQuery(<ProductGrid />);

    expect(screen.getByText("Loading featured products")).toBeInTheDocument();
    expect(await screen.findByText("Aurora Lamp")).toBeInTheDocument();
    expect(screen.getByText("Vellum Chair")).toBeInTheDocument();
  });

  it("shows an empty state when the featured edit has no products", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => makeResponse(makeList([]))));

    renderWithQuery(<ProductGrid />);

    expect(
      await screen.findByText("No featured products right now."),
    ).toBeInTheDocument();
  });

  it("shows an error state and recovers when the shopper retries", async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(makeResponse({ message: "boom" }, 500))
      .mockResolvedValueOnce(
        makeResponse(makeList([makeProduct(9, "Recovered Table")])),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<ProductGrid />);

    expect(
      await screen.findByText("We couldn't load the featured products."),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Recovered Table")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rehydrates persisted cart state on the client", async () => {
    const persisted = {
      productId: 7,
      title: "Persisted product",
      price: 42,
      discountPercentage: 0,
      quantity: 2,
    };
    window.localStorage.setItem(
      STORAGE_KEYS.cart,
      JSON.stringify({ state: { lines: [persisted] }, version: 1 }),
    );

    function CartProbe() {
      const hydrated = useHydrated();
      const lineCount = useCartStore((state) => state.lines.length);
      return <span>{hydrated ? `hydrated:${lineCount}` : "pending"}</span>;
    }

    render(<CartProbe />);

    expect(await screen.findByText("hydrated:1")).toBeInTheDocument();
  });
});
