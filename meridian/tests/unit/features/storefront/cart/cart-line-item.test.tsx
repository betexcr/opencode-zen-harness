import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { CartLineItem } from "@/features/storefront/cart/cart-line-item";
import type { CartLine } from "@/lib/domain/cart";
import { useCartStore } from "@/lib/state";

/**
 * Unit tests for the editable cart line mounted in the persistent drawer.
 *
 * `CartLineItem` is presentation-only: every price comes from the pure
 * `lib/domain/cart` money helpers and every mutation flows through the shared
 * `cartActions` surface, so these tests assert the rendered money and the
 * resulting persisted-store side-effects. They deliberately exercise the
 * minimum-order-quantity and captured-stock clamps, which are the rules that
 * make the drawer's steppers safe.
 */

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 1,
    title: "Aurora Lamp",
    thumbnail: "",
    price: 25,
    discountPercentage: 0,
    quantity: 2,
    minimumOrderQuantity: 1,
    stock: 10,
    ...overrides,
  };
}

describe("CartLineItem", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCartStore.setState({ lines: [] });
  });

  it("renders the title, unit price and line total with money formatting", () => {
    const line = makeLine();
    useCartStore.setState({ lines: [line] });

    render(<CartLineItem line={line} />);

    expect(screen.getByText("Aurora Lamp")).toBeInTheDocument();
    expect(screen.getByText("$25.00 each")).toBeInTheDocument();
    expect(screen.getByText("$50.00")).toBeInTheDocument();
  });

  it("shows the pre-discount price struck through when the line is on sale", () => {
    const line = makeLine({ price: 100, discountPercentage: 10, quantity: 1 });
    useCartStore.setState({ lines: [line] });

    render(<CartLineItem line={line} />);

    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$90.00 each")).toBeInTheDocument();
  });

  it("increments the stored quantity by one MOQ step", async () => {
    const line = makeLine({ productId: 5, quantity: 2, stock: 5 });
    useCartStore.setState({ lines: [line] });

    render(<CartLineItem line={line} />);

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /increase quantity of aurora lamp/i }),
    );

    expect(useCartStore.getState().lines[0]?.quantity).toBe(3);
  });

  it("decrements the stored quantity by one MOQ step", async () => {
    const line = makeLine({ productId: 6, quantity: 3, stock: 5 });
    useCartStore.setState({ lines: [line] });

    render(<CartLineItem line={line} />);

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /decrease quantity of aurora lamp/i }),
    );

    expect(useCartStore.getState().lines[0]?.quantity).toBe(2);
  });

  it("never steps below the minimum order quantity", () => {
    const line = makeLine({
      productId: 7,
      quantity: 4,
      minimumOrderQuantity: 4,
      stock: 100,
    });
    useCartStore.setState({ lines: [line] });

    render(<CartLineItem line={line} />);

    expect(
      screen.getByRole("button", { name: /decrease quantity of aurora lamp/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /increase quantity of aurora lamp/i }),
    ).toBeEnabled();
    expect(screen.getByText("Minimum order quantity: 4")).toBeInTheDocument();
  });

  it("never steps above the captured stock", () => {
    const line = makeLine({
      productId: 8,
      quantity: 2,
      minimumOrderQuantity: 1,
      stock: 2,
    });
    useCartStore.setState({ lines: [line] });

    render(<CartLineItem line={line} />);

    expect(
      screen.getByRole("button", { name: /increase quantity of aurora lamp/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /decrease quantity of aurora lamp/i }),
    ).toBeEnabled();
  });

  it("removes the line from the cart", async () => {
    const line = makeLine({ productId: 9 });
    useCartStore.setState({ lines: [line] });

    render(<CartLineItem line={line} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(useCartStore.getState().lines).toHaveLength(0);
  });
});
