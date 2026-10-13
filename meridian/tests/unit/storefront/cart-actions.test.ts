import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cartActions,
  addToCart,
  canDecrementCartLine,
  canIncrementCartLine,
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
import {
  cartDiscount,
  cartDiscountedTotal,
  cartItemCount,
  cartSubtotal,
  cartSubtotalCents,
  lineTotal,
  type CartLine,
} from "@/lib/domain/cart";
import {
  selectCartDiscountedTotal,
  selectCartDiscount,
  selectCartItemCount,
  selectCartQuantity,
  selectCartSubtotal,
  useCartStore,
} from "@/lib/state";

/**
 * Unit tests for the cart interaction helpers in
 * `features/storefront/cart/cart-actions.ts`.
 */

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 1,
    title: "Sample",
    thumbnail: "sample.png",
    price: 25,
    discountPercentage: 0,
    quantity: 1,
    ...overrides,
  };
}

function makeInput(overrides: Partial<CartLineInput> = {}): CartLineInput {
  return {
    id: 1,
    title: "Sample",
    thumbnail: "sample.png",
    price: 25,
    discountPercentage: 0,
    stock: 10,
    minimumOrderQuantity: 1,
    ...overrides,
  };
}

function lines(): CartLine[] {
  return useCartStore.getState().lines;
}

describe("cart-actions helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCartStore.setState({ lines: [] });
    vi.restoreAllMocks();
  });

  describe("minimumOrderQuantityOf", () => {
    it("floors to at least one unit", () => {
      expect(minimumOrderQuantityOf({ stock: 10, minimumOrderQuantity: 0 })).toBe(1);
      expect(minimumOrderQuantityOf({ stock: 10, minimumOrderQuantity: 3 })).toBe(3);
      expect(minimumOrderQuantityOf({ stock: 10, minimumOrderQuantity: 2.9 })).toBe(2);
    });

    it("defaults to 1 when absent or non-finite", () => {
      expect(minimumOrderQuantityOf({ stock: 10 })).toBe(1);
      expect(
        minimumOrderQuantityOf({ stock: 10, minimumOrderQuantity: Number.NaN }),
      ).toBe(1);
    });
  });

  describe("cartLineBounds", () => {
    it("reports orderable range from MOQ and stock", () => {
      expect(cartLineBounds({ stock: 10, minimumOrderQuantity: 2 })).toEqual({
        minimum: 2,
        maximum: 10,
      });
    });

    it("reports zero maximum when unorderable", () => {
      expect(cartLineBounds({ stock: 0, minimumOrderQuantity: 1 }).maximum).toBe(0);
      expect(cartLineBounds({ stock: 1, minimumOrderQuantity: 5 }).maximum).toBe(0);
    });
  });

  describe("clampCartQuantity", () => {
    it("raises below minimum to minimum", () => {
      expect(clampCartQuantity({ stock: 100, minimumOrderQuantity: 5 }, 2)).toBe(5);
      expect(clampCartQuantity({ stock: 100, minimumOrderQuantity: 5 }, 0)).toBe(5);
    });

    it("caps above stock at maximum", () => {
      expect(clampCartQuantity({ stock: 8, minimumOrderQuantity: 1 }, 99)).toBe(8);
    });

    it("yields zero for unorderable product", () => {
      expect(clampCartQuantity({ stock: 0, minimumOrderQuantity: 1 }, 5)).toBe(0);
    });
  });

  describe("toCartLine", () => {
    it("maps input to cart line shape", () => {
      const line = toCartLine(makeInput({ id: 42, price: 12.5 }), 4);
      expect(line).toEqual({
        productId: 42,
        title: "Sample",
        thumbnail: "sample.png",
        price: 12.5,
        discountPercentage: 0,
        quantity: 4,
      });
    });
  });

  describe("addToCart", () => {
    it("adds new line with clamped quantity", () => {
      const added = addToCart(
        useCartStore.getState(),
        makeInput({ id: 1, price: 25 }),
        3,
      );

      expect(added).toBe(3);
      expect(lines()).toHaveLength(1);
      expect(selectCartQuantity(1)(useCartStore.getState())).toBe(3);
      expect(cartSubtotalCents(lines())).toBe(7500);
    });

    it("merges into existing line summing quantities", () => {
      addToCart(useCartStore.getState(), makeInput({ id: 1 }), 2);
      addToCart(useCartStore.getState(), makeInput({ id: 1 }), 3);

      expect(lines()).toHaveLength(1);
      expect(selectCartQuantity(1)(useCartStore.getState())).toBe(5);
      expect(cartItemCount(lines())).toBe(5);
    });

    it("raises to MOQ and caps to stock", () => {
      expect(
        addToCart(
          useCartStore.getState(),
          makeInput({ id: 1, minimumOrderQuantity: 4, stock: 20 }),
          1,
        ),
      ).toBe(4);

      useCartStore.setState({ lines: [] });
      expect(
        addToCart(
          useCartStore.getState(),
          makeInput({ id: 2, stock: 3 }),
          99,
        ),
      ).toBe(3);
    });

    it("leaves cart untouched when out of stock", () => {
      const added = addToCart(
        useCartStore.getState(),
        makeInput({ id: 1, stock: 0 }),
        2,
      );
      expect(added).toBe(0);
      expect(lines()).toHaveLength(0);
    });
  });

  describe("setCartLineQuantity", () => {
    it("sets absolute quantity clamped; zero removes line", () => {
      addToCart(useCartStore.getState(), makeInput({ id: 1, stock: 10 }), 2);

      expect(
        setCartLineQuantity(
          useCartStore.getState(),
          makeInput({ id: 1, stock: 10 }),
          6,
        ),
      ).toBe(6);
      expect(selectCartQuantity(1)(useCartStore.getState())).toBe(6);

      expect(
        setCartLineQuantity(
          useCartStore.getState(),
          makeInput({ id: 1, stock: 6 }),
          50,
        ),
      ).toBe(6);

      expect(
        setCartLineQuantity(
          useCartStore.getState(),
          makeInput({ id: 1, stock: 0 }),
          3,
        ),
      ).toBe(0);
      expect(lines()).toHaveLength(0);
    });
  });

  describe("canIncrement/canDecrement", () => {
    it("checks guards correctly", () => {
      expect(canIncrementCartLine(makeLine({ quantity: 2 }), { stock: 10 })).toBe(true);
      expect(canIncrementCartLine(makeLine({ quantity: 10 }), { stock: 10 })).toBe(false);

      expect(
        canDecrementCartLine(makeLine({ quantity: 3 }), {
          stock: 10,
          minimumOrderQuantity: 2,
        }),
      ).toBe(true);
      expect(
        canDecrementCartLine(makeLine({ quantity: 2 }), {
          stock: 10,
          minimumOrderQuantity: 2,
        }),
      ).toBe(false);
    });
  });

  describe("increment/decrement", () => {
    it("increments by step and clamps at stock", () => {
      addToCart(useCartStore.getState(), makeInput({ id: 1, stock: 4 }), 3);
      let line = lines()[0];
      expect(
        incrementCartLine(useCartStore.getState(), line, { stock: 4 }, 5),
      ).toBe(4);
      expect(selectCartQuantity(1)(useCartStore.getState())).toBe(4);

      useCartStore.setState({ lines: [] });
      addToCart(useCartStore.getState(), makeInput({ id: 1, stock: 10 }), 2);
      line = lines()[0];
      expect(incrementCartLine(useCartStore.getState(), line, { stock: 10 })).toBe(3);
    });

    it("decrements by step and clamps at minimum", () => {
      addToCart(
        useCartStore.getState(),
        makeInput({ id: 1, stock: 10, minimumOrderQuantity: 2 }),
        5,
      );
      const line = lines()[0];
      expect(
        decrementCartLine(
          useCartStore.getState(),
          line,
          { stock: 10, minimumOrderQuantity: 2 },
          10,
        ),
      ).toBe(2);
      expect(selectCartQuantity(1)(useCartStore.getState())).toBe(2);

      expect(
        decrementCartLine(
          useCartStore.getState(),
          lines()[0],
          { stock: 10, minimumOrderQuantity: 2 },
        ),
      ).toBe(2);
    });
  });

  describe("remove and clear", () => {
    it("removes line and clears all lines", () => {
      addToCart(useCartStore.getState(), makeInput({ id: 1 }), 2);
      addToCart(useCartStore.getState(), makeInput({ id: 2 }), 1);
      removeCartLine(useCartStore.getState(), 1);
      expect(lines()).toHaveLength(1);

      clearCart(useCartStore.getState());
      expect(lines()).toEqual([]);
      expect(cartItemCount(lines())).toBe(0);
    });
  });

  describe("totals through store selectors", () => {
    it("reflects domain math for discounted cart", () => {
      addToCart(
        useCartStore.getState(),
        makeInput({ id: 1, price: 100, discountPercentage: 25, stock: 10 }),
        2,
      );
      addToCart(
        useCartStore.getState(),
        makeInput({ id: 2, price: 50, discountPercentage: 0, stock: 10 }),
        1,
      );

      const state = useCartStore.getState();
      expect(selectCartSubtotal(state)).toBe(cartSubtotal(state.lines));
      expect(selectCartDiscount(state)).toBe(cartDiscount(state.lines));
      expect(selectCartDiscountedTotal(state)).toBe(cartDiscountedTotal(state.lines));
      expect(selectCartItemCount(state)).toBe(3);
      expect(cartDiscountedTotal(state.lines)).toBe(200);
      expect(lineTotal(state.lines[0])).toBe(150);
    });
  });

  describe("bound cartActions surface", () => {
    it("mutates store and exposes guards", () => {
      cartActions.add(makeInput({ id: 7, price: 10, stock: 5 }), 2);
      expect(selectCartQuantity(7)(useCartStore.getState())).toBe(2);

      let line = lines()[0];
      cartActions.increment(line, { stock: 5 });
      expect(selectCartQuantity(7)(useCartStore.getState())).toBe(3);

      line = lines()[0];
      cartActions.decrement(line, { stock: 5 });
      expect(selectCartQuantity(7)(useCartStore.getState())).toBe(2);

      cartActions.setQuantity(makeInput({ id: 7, price: 10, stock: 5 }), 4);
      expect(selectCartQuantity(7)(useCartStore.getState())).toBe(4);

      expect(cartActions.canIncrement(lines()[0], { stock: 5 })).toBe(true);
      cartActions.setQuantity(makeInput({ id: 7, stock: 5 }), 5);
      expect(cartActions.canIncrement(lines()[0], { stock: 5 })).toBe(false);

      cartActions.remove(7);
      expect(selectCartQuantity(7)(useCartStore.getState())).toBe(0);

      cartActions.add(makeInput({ id: 8, price: 10, stock: 5 }), 1);
      cartActions.clear();
      expect(lines()).toEqual([]);
    });
  });
});
