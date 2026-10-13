import { describe, expect, it, vi } from "vitest";

import {
  addToCart,
  canDecrementCartLine,
  canIncrementCartLine,
  cartActions,
  cartLineBounds,
  clampCartQuantity,
  clearCart,
  decrementCartLine,
  incrementCartLine,
  minimumOrderQuantityOf,
  removeCartLine,
  setCartLineQuantity,
  toCartLine,
  type CartLineInput,
} from "@/features/storefront/cart/cart-actions";
import type { CartLine } from "@/lib/domain/cart";
import { useCartStore } from "@/lib/state";

/**
 * These tests cover the pure cart interaction helpers. Each fake surface records
 * the delegated store call so the helpers can be asserted without mounting
 * React or touching persisted state.
 */
function fakeActions() {
  return {
    addLine: vi.fn(),
    setQuantity: vi.fn(),
    incrementLine: vi.fn(),
    decrementLine: vi.fn(),
    removeLine: vi.fn(),
    clear: vi.fn(),
  };
}

/** 10.00 @ 20% off, stock 5, MOQ 2 => orderable [2, 4]. */
const product: CartLineInput = {
  id: 7,
  title: "Widget",
  thumbnail: "widget.webp",
  price: 10,
  discountPercentage: 20,
  stock: 5,
  minimumOrderQuantity: 2,
};

function line(quantity: number): CartLine {
  return {
    productId: 7,
    title: "Widget",
    thumbnail: "widget.webp",
    price: 10,
    discountPercentage: 20,
    quantity,
  };
}

describe("cart-actions.minimumOrderQuantityOf", () => {
  it("defaults to one whole unit when unset or invalid", () => {
    expect(minimumOrderQuantityOf({ stock: 5 })).toBe(1);
    expect(minimumOrderQuantityOf({ stock: 5, minimumOrderQuantity: 0 })).toBe(1);
    expect(
      minimumOrderQuantityOf({ stock: 5, minimumOrderQuantity: Number.NaN }),
    ).toBe(1);
  });

  it("floors a positive minimum order quantity", () => {
    expect(minimumOrderQuantityOf({ stock: 5, minimumOrderQuantity: 3.9 })).toBe(3);
  });
});

describe("cart-actions.cartLineBounds", () => {
  it("uses the MOQ as the lower bound and stock floored to the MOQ as the maximum", () => {
    expect(cartLineBounds(product)).toEqual({ minimum: 2, maximum: 4 });
  });

  it("reports an unorderable product with a zero maximum", () => {
    expect(cartLineBounds({ stock: 0, minimumOrderQuantity: 1 })).toEqual({
      minimum: 1,
      maximum: 0,
    });
    expect(cartLineBounds({ stock: 3, minimumOrderQuantity: 5 })).toEqual({
      minimum: 5,
      maximum: 0,
    });
  });
});

describe("cart-actions.clampCartQuantity", () => {
  it("raises a request below the minimum order quantity", () => {
    expect(clampCartQuantity(product, 1)).toBe(2);
  });

  it("caps a request above available stock at the MOQ-aligned maximum", () => {
    expect(clampCartQuantity(product, 10)).toBe(4);
  });

  it("passes through an in-range request", () => {
    expect(clampCartQuantity(product, 3)).toBe(3);
  });

  it("returns zero when nothing is orderable", () => {
    expect(clampCartQuantity({ stock: 0, minimumOrderQuantity: 1 }, 5)).toBe(0);
    expect(clampCartQuantity({ stock: 3, minimumOrderQuantity: 5 }, 1)).toBe(0);
  });
});

describe("cart-actions.toCartLine", () => {
  it("captures identity and display fields with a normalized quantity", () => {
    expect(toCartLine(product, 2.9)).toEqual({
      productId: 7,
      title: "Widget",
      thumbnail: "widget.webp",
      price: 10,
      discountPercentage: 20,
      quantity: 2,
    });
  });
});

describe("cart-actions.addToCart", () => {
  it("clamps the requested quantity to the minimum order quantity", () => {
    const actions = fakeActions();
    expect(addToCart(actions, product)).toBe(2);
    expect(actions.addLine).toHaveBeenCalledTimes(1);
    expect(actions.addLine).toHaveBeenCalledWith(
      {
        productId: 7,
        title: "Widget",
        thumbnail: "widget.webp",
        price: 10,
        discountPercentage: 20,
        quantity: 2,
      },
      2,
    );
  });

  it("caps the requested quantity at available stock", () => {
    const actions = fakeActions();
    expect(addToCart(actions, product, 99)).toBe(4);
    expect(actions.addLine).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 4 }),
      4,
    );
  });

  it("leaves the cart untouched when the product is not orderable", () => {
    const actions = fakeActions();
    expect(addToCart(actions, { ...product, stock: 0 })).toBe(0);
    expect(actions.addLine).not.toHaveBeenCalled();
  });
});

describe("cart-actions.setCartLineQuantity", () => {
  it("clamps the absolute quantity and delegates to setQuantity", () => {
    const actions = fakeActions();
    expect(setCartLineQuantity(actions, product, 100)).toBe(4);
    expect(actions.setQuantity).toHaveBeenCalledWith(7, 4);
  });

  it("delegates a zero quantity so the store removes the line", () => {
    const actions = fakeActions();
    expect(setCartLineQuantity(actions, { ...product, stock: 0 }, 3)).toBe(0);
    expect(actions.setQuantity).toHaveBeenCalledWith(7, 0);
  });
});

describe("cart-actions.canIncrement / canDecrement", () => {
  it("blocks incrementing at the stock maximum", () => {
    expect(canIncrementCartLine(line(4), product)).toBe(false);
    expect(canIncrementCartLine(line(3), product)).toBe(true);
  });

  it("blocks decrementing at the minimum order quantity", () => {
    expect(canDecrementCartLine(line(2), product)).toBe(false);
    expect(canDecrementCartLine(line(3), product)).toBe(true);
  });
});

describe("cart-actions.incrementCartLine", () => {
  it("steps by one and delegates to incrementLine", () => {
    const actions = fakeActions();
    expect(incrementCartLine(actions, line(2), product)).toBe(3);
    expect(actions.incrementLine).toHaveBeenCalledWith(7, 1);
  });

  it("never exceeds the stock maximum", () => {
    const actions = fakeActions();
    expect(incrementCartLine(actions, line(2), product, 5)).toBe(4);
    expect(actions.incrementLine).toHaveBeenCalledWith(7, 2);
  });

  it("is a no-op when already at the maximum", () => {
    const actions = fakeActions();
    expect(incrementCartLine(actions, line(4), product)).toBe(4);
    expect(actions.incrementLine).not.toHaveBeenCalled();
  });
});

describe("cart-actions.decrementCartLine", () => {
  it("steps down by one and delegates to decrementLine", () => {
    const actions = fakeActions();
    expect(decrementCartLine(actions, line(4), product)).toBe(3);
    expect(actions.decrementLine).toHaveBeenCalledWith(7, 1);
  });

  it("never drops below the minimum order quantity", () => {
    const actions = fakeActions();
    expect(decrementCartLine(actions, line(4), product, 5)).toBe(2);
    expect(actions.decrementLine).toHaveBeenCalledWith(7, 2);
  });

  it("is a no-op when already at the minimum", () => {
    const actions = fakeActions();
    expect(decrementCartLine(actions, line(2), product)).toBe(2);
    expect(actions.decrementLine).not.toHaveBeenCalled();
  });
});

describe("cart-actions.removeCartLine / clearCart", () => {
  it("delegates line removal", () => {
    const actions = fakeActions();
    removeCartLine(actions, 7);
    expect(actions.removeLine).toHaveBeenCalledWith(7);
  });

  it("delegates clearing the whole cart", () => {
    const actions = fakeActions();
    clearCart(actions);
    expect(actions.clear).toHaveBeenCalledTimes(1);
  });
});

describe("cart-actions.cartActions (bound to the persisted store)", () => {
  it("mutates the real cart store through the clamped helpers", () => {
    useCartStore.getState().clear();

    expect(cartActions.add(product, 1)).toBe(2);
    const [stored] = useCartStore.getState().lines;
    expect(stored).toMatchObject({ productId: 7, quantity: 2 });

    expect(cartActions.increment(stored, product)).toBe(3);
    expect(useCartStore.getState().lines[0]?.quantity).toBe(3);

    cartActions.remove(7);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });
});
