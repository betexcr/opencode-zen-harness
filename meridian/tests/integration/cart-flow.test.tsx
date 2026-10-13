import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CartPage } from "@/app/(storefront)/cart/page";
import { AddToCart } from "@/features/storefront/product-detail/add-to-cart";
import type { Product } from "@/lib/api/schemas";
import type { CartLine } from "@/lib/domain/cart";
import { useCartStore } from "@/lib/state";

/**
 * Integration coverage for the cart page mutation flow.
 *
 * The cart is LOCAL persisted browser state, so this suite drives the real
 * `useCartStore` (reset and read at the boundary) rather than a spy surface.
 * The hydration gate is mocked via a shared hoisted flag so both the
 * pre-hydration loading state and the hydrated cart page can be asserted.
 * Every total asserted here comes from the same `estimateOrderTotals` math the
 * page renders, so table and summary can never disagree.
 */

const state = vi.hoisted(() => ({ hydrated: true }));

vi.mock("@/hooks/use-hydrated", () => ({
  useHydrated: () => state.hydrated,
}));

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 1,
    title: "Aurora Lamp",
    thumbnail: "https://cdn.dummyjson.com/product-images/1.webp",
    price: 25,
    discountPercentage: 0,
    quantity: 1,
    minimumOrderQuantity: 1,
    stock: 10,
    ...overrides,
  };
}

function makeAddableProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: "Aurora Lamp",
    description: "A warm, dimmable table lamp.",
    category: "home-decoration",
    price: 25,
    discountPercentage: 0,
    rating: 4.5,
    stock: 10,
    tags: [],
    brand: "Meridian",
    sku: "SKU-1",
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

describe("cart flow integration", () => {
  beforeEach(() => {
    state.hydrated = true;
    window.localStorage.clear();
    useCartStore.setState({ lines: [] });
  });

  afterEach(() => {
    window.localStorage.clear();
    useCartStore.setState({ lines: [] });
  });

  it("shows the loading state until the persisted cart has rehydrated", () => {
    state.hydrated = false;
    useCartStore.setState({ lines: [makeLine()] });

    render(<CartPage />);

    expect(screen.getByText("Loading your cart")).toBeInTheDocument();
    expect(screen.queryByText("Aurora Lamp")).toBeNull();
    expect(screen.queryByText("Order summary")).toBeNull();
  });

  it("adds a product through Add to cart and reflects it in the totals", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <AddToCart product={makeAddableProduct()} />
        <CartPage />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0]).toMatchObject({
      productId: 1,
      quantity: 1,
    });

    const summary = screen.getByRole("complementary", {
      name: "Order summary",
    });
    expect(screen.getByText("Aurora Lamp")).toBeInTheDocument();
    expect(within(summary).getByText("$25.00")).toBeInTheDocument();
    expect(within(summary).getByText("$5.99")).toBeInTheDocument();
    expect(within(summary).getByText("$1.75")).toBeInTheDocument();
    expect(within(summary).getByText("$32.74")).toBeInTheDocument();
  });

  it("increments a line quantity and recomputes the totals", async () => {
    useCartStore.setState({ lines: [makeLine({ quantity: 2 })] });
    const user = userEvent.setup();

    render(<CartPage />);

    await user.click(
      screen.getByRole("button", { name: "Increase quantity of Aurora Lamp" }),
    );

    expect(useCartStore.getState().lines[0].quantity).toBe(3);

    const summary = screen.getByRole("complementary", {
      name: "Order summary",
    });
    expect(within(summary).getByText("$75.00")).toBeInTheDocument();
    expect(within(summary).getByText("Free")).toBeInTheDocument();
    expect(within(summary).getByText("$5.25")).toBeInTheDocument();
    expect(within(summary).getByText("$80.25")).toBeInTheDocument();
  });

  it("clamps a decrement at the minimum order quantity", async () => {
    useCartStore.setState({
      lines: [makeLine({ quantity: 3, minimumOrderQuantity: 2 })],
    });
    const user = userEvent.setup();

    render(<CartPage />);

    expect(screen.getByText("Minimum order 2")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Decrease quantity of Aurora Lamp" }),
    );

    expect(useCartStore.getState().lines[0].quantity).toBe(2);
    expect(
      screen.getByRole("button", { name: "Decrease quantity of Aurora Lamp" }),
    ).toBeDisabled();

    const summary = screen.getByRole("complementary", {
      name: "Order summary",
    });
    expect(within(summary).getByText("$50.00")).toBeInTheDocument();
    expect(within(summary).getByText("Free")).toBeInTheDocument();
    expect(within(summary).getByText("$3.50")).toBeInTheDocument();
    expect(within(summary).getByText("$53.50")).toBeInTheDocument();
  });

  it("removes a line and shows the empty cart state", async () => {
    useCartStore.setState({ lines: [makeLine()] });
    const user = userEvent.setup();

    render(<CartPage />);

    await user.click(
      screen.getByRole("button", { name: "Remove Aurora Lamp from cart" }),
    );

    expect(useCartStore.getState().lines).toHaveLength(0);
    expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.queryByText("Order summary")).toBeNull();
  });

  it("renders discounted unit pricing and the discount row in the summary", () => {
    useCartStore.setState({
      lines: [makeLine({ price: 100, discountPercentage: 20, quantity: 1 })],
    });

    render(<CartPage />);

    expect(screen.getAllByText("$80.00")).toHaveLength(2);
    expect(screen.getAllByText("$100.00")).toHaveLength(2);

    const summary = screen.getByRole("complementary", {
      name: "Order summary",
    });
    expect(within(summary).getByText("$100.00")).toBeInTheDocument();
    expect(within(summary).getByText("-$20.00")).toBeInTheDocument();
    expect(within(summary).getByText("Free")).toBeInTheDocument();
    expect(within(summary).getByText("$5.60")).toBeInTheDocument();
    expect(within(summary).getByText("$85.60")).toBeInTheDocument();
  });
});