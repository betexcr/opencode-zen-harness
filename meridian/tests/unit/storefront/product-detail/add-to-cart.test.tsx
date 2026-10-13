import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddToCart } from "@/features/storefront/product-detail/add-to-cart";
import { cartActions } from "@/features/storefront/cart/cart-actions";
import { wishlistActions } from "@/features/storefront/wishlist/wishlist-actions";
import type { Product } from "@/lib/api/schemas";
import { useWishlistStore } from "@/lib/state";

/**
 * The hydration gate defers persisted-store reads until after mount. The
 * component is a client component, so hydration is mocked on to exercise the
 * interactive quantity selector and wishlist toggle. A dedicated suite tests
 * the pre-hydration behavior.
 */
vi.mock("@/hooks/use-hydrated", () => ({
  useHydrated: () => true,
}));

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
    tags: [],
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

beforeEach(() => {
  useWishlistStore.setState({ ids: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AddToCart — quantity selector", () => {
  it("defaults to the minimum order quantity", () => {
    render(<AddToCart product={makeProduct({ minimumOrderQuantity: 3 })} />);
    expect(screen.getByLabelText("Quantity")).toHaveValue(3);
    expect(screen.getByText("MOQ: 3")).toBeInTheDocument();
  });

  it("never decrements below the minimum order quantity", async () => {
    const user = userEvent.setup();
    render(<AddToCart product={makeProduct({ minimumOrderQuantity: 3 })} />);

    const decrement = screen.getByLabelText("Decrease quantity");
    expect(decrement).toBeDisabled();

    await user.click(screen.getByLabelText("Increase quantity"));
    expect(screen.getByLabelText("Quantity")).toHaveValue(6);

    expect(decrement).toBeEnabled();
    await user.click(decrement);
    expect(screen.getByLabelText("Quantity")).toHaveValue(3);
    expect(decrement).toBeDisabled();
  });

  it("steps in MOQ increments and caps at available stock", async () => {
    const user = userEvent.setup();
    render(
      <AddToCart
        product={makeProduct({ minimumOrderQuantity: 3, stock: 7 })}
      />,
    );

    const increase = screen.getByLabelText("Increase quantity");
    await user.click(increase);
    expect(screen.getByLabelText("Quantity")).toHaveValue(6);
    expect(increase).toBeDisabled();
  });

  it("does not render the quantity selector when out of stock", () => {
    render(<AddToCart product={makeProduct({ stock: 0 })} />);

    expect(screen.queryByLabelText("Quantity")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /out of stock/i }),
    ).toBeDisabled();
  });
});

describe("AddToCart — mutations route through helpers", () => {
  it("adds the selected quantity through cartActions.add", async () => {
    const user = userEvent.setup();
    const addSpy = vi.spyOn(cartActions, "add").mockReturnValue(6);
    render(
      <AddToCart
        product={makeProduct({ minimumOrderQuantity: 3, stock: 20 })}
      />,
    );

    await user.click(screen.getByLabelText("Increase quantity"));
    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(addSpy).toHaveBeenCalledTimes(1);
    const [input, quantity] = addSpy.mock.calls[0];
    expect(input).toMatchObject({
      id: 42,
      title: "Aurora Lamp",
      thumbnail: "https://cdn.dummyjson.com/products/images/1.png",
      price: 100,
      discountPercentage: 10,
      stock: 20,
      minimumOrderQuantity: 3,
    });
    expect(quantity).toBe(6);
  });

  it("does not add to cart when out of stock", async () => {
    const user = userEvent.setup();
    const addSpy = vi.spyOn(cartActions, "add");
    render(<AddToCart product={makeProduct({ stock: 0 })} />);

    const addButton = screen.getByRole("button", { name: /out of stock/i });
    await user.click(addButton);

    expect(addSpy).not.toHaveBeenCalled();
  });

  it("toggles wishlist membership through the persisted store", async () => {
    const user = userEvent.setup();
    render(<AddToCart product={makeProduct()} />);

    const toggle = screen.getByRole("button", { name: /add to wishlist/i });
    await user.click(toggle);

    expect(useWishlistStore.getState().ids).toContain(42);
    expect(
      screen.getByRole("button", { name: /in wishlist/i }),
    ).toBeInTheDocument();
  });

  it("delegates the wishlist toggle to wishlistActions.toggle", async () => {
    const user = userEvent.setup();
    const toggleSpy = vi.spyOn(wishlistActions, "toggle").mockReturnValue(true);
    render(<AddToCart product={makeProduct()} />);

    await user.click(screen.getByRole("button", { name: /add to wishlist/i }));

    expect(toggleSpy).toHaveBeenCalledWith(42);
  });
});
