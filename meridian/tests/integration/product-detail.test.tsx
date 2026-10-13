import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { ProductDetailView } from "@/features/storefront/product-detail/product-detail-view";
import type { Product, ProductReview } from "@/lib/api/schemas";
import { useCartStore } from "@/lib/state";

/**
 * Integration coverage for the product detail view.
 *
 * The view is a client component whose query owns the request lifecycle, so the
 * fetch is stubbed at the boundary (the typed client in `lib/api` reads only
 * ok/status/json). The hydration gate is mocked on so the interactive
 * add-to-cart controls render in their hydrated, enabled state.
 */

const state = vi.hoisted(() => ({ hydrated: true }));

vi.mock("@/hooks/use-hydrated", () => ({
  useHydrated: () => state.hydrated,
}));

function makeReview(overrides: Partial<ProductReview> = {}): ProductReview {
  return {
    rating: 5,
    comment: "Beautiful lamp.",
    date: "2024-05-23T08:56:21.618Z",
    reviewerName: "Jane Doe",
    reviewerEmail: "jane.doe@example.com",
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 42,
    title: "Aurora Lamp",
    description: "A warm, dimmable table lamp.",
    category: "home-decoration",
    price: 100,
    discountPercentage: 10,
    rating: 4.5,
    stock: 20,
    tags: ["lighting"],
    brand: "Meridian",
    sku: "SKU-42",
    weight: 2,
    dimensions: { width: 10, height: 20, depth: 5 },
    warrantyInformation: "1 year",
    shippingInformation: "Ships in 2 days",
    availabilityStatus: "In Stock",
    reviews: [],
    returnPolicy: "30 day returns",
    minimumOrderQuantity: 1,
    images: ["https://cdn.dummyjson.com/products/images/1.png"],
    thumbnail: "https://cdn.dummyjson.com/products/images/1.png",
    ...overrides,
  };
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

describe("product detail integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCartStore.setState({ lines: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    useCartStore.setState({ lines: [] });
  });

  it("shows a loading skeleton, then the product details from the API", async () => {
    const fetchMock = vi.fn<() => Promise<Response>>(async () =>
      makeResponse(makeProduct()),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<ProductDetailView id={42} />);

    expect(screen.getByText("Loading product")).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: "Aurora Lamp" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Meridian")).toBeInTheDocument();
    expect(screen.getByText("$90.00")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("A warm, dimmable table lamp.")).toBeInTheDocument();
    expect(screen.getByText("SKU-42")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add to cart/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("No reviews yet.")).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/products/42"),
      expect.anything(),
    );
  });

  it("renders the reviews section when the product has reviews", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<() => Promise<Response>>(async () =>
        makeResponse(makeProduct({ reviews: [makeReview()] })),
      ),
    );

    renderWithQuery(<ProductDetailView id={42} />);

    expect(
      await screen.findByText("Customer Reviews (1)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Beautiful lamp.")).toBeInTheDocument();
  });

  it("shows an error state and recovers when the shopper retries", async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(makeResponse({ message: "boom" }, 500))
      .mockResolvedValueOnce(
        makeResponse(makeProduct({ title: "Recovered Lamp" })),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQuery(<ProductDetailView id={42} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load this product.");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "Recovered Lamp" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});