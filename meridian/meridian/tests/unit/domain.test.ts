import { describe, expect, it } from "vitest";

import {
  cartDiscount,
  cartDiscountedTotal,
  cartItemCount,
  cartLineCount,
  cartSubtotal,
  estimateOrderTotals,
  normalizeQuantity,
  type CartLine,
} from "@/lib/domain/cart";
import {
  fromCents,
  formatCurrency,
  roundCents,
  toCents,
} from "@/lib/domain/money";
import {
  discountAmount,
  discountedPrice,
  discountedPriceCents,
} from "@/lib/domain/pricing";

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 1,
    title: "Test product",
    thumbnail: "https://cdn.dummyjson.com/product-images/1.webp",
    price: 100,
    discountPercentage: 0,
    quantity: 1,
    ...overrides,
  };
}

describe("money", () => {
  it("converts currency units to integer cents", () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0)).toBe(0);
    expect(fromCents(1999)).toBe(19.99);
  });

  it("rounds half away from zero and normalizes negative zero", () => {
    expect(roundCents(0.5)).toBe(1);
    expect(roundCents(-0.5)).toBe(-1);
    expect(roundCents(2.5)).toBe(3);
    expect(Object.is(roundCents(-0.4), 0)).toBe(true);
  });

  it("avoids binary floating point drift", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it("formats cents as localized currency", () => {
    expect(formatCurrency(toCents(19.99))).toBe("$19.99");
  });

  it("rejects non-finite values", () => {
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => roundCents(Number.NaN)).toThrow(RangeError);
  });
});

describe("pricing", () => {
  it("computes discounted price and discount amount", () => {
    expect(discountedPrice(100, 25)).toBe(75);
    expect(discountedPriceCents(toCents(100), 25)).toBe(7500);
    expect(discountAmount(100, 25)).toBe(25);
  });

  it("rounds the discounted price to whole cents", () => {
    expect(discountedPriceCents(toCents(9.99), 15)).toBe(849);
  });
});

describe("cart calculations", () => {
  it("normalizes quantities to non-negative integers", () => {
    expect(normalizeQuantity(2.9)).toBe(2);
    expect(normalizeQuantity(-5)).toBe(0);
    expect(normalizeQuantity(Number.NaN)).toBe(0);
  });

  it("counts lines and items", () => {
    const lines = [
      line({ quantity: 2 }),
      line({ productId: 2, quantity: 3 }),
    ];
    expect(cartLineCount(lines)).toBe(2);
    expect(cartItemCount(lines)).toBe(5);
  });

  it("computes subtotal, discount, and discounted total", () => {
    const lines = [line({ price: 100, discountPercentage: 10, quantity: 2 })];
    expect(cartSubtotal(lines)).toBe(200);
    expect(cartDiscount(lines)).toBe(20);
    expect(cartDiscountedTotal(lines)).toBe(180);
  });

  it("estimates order totals with tax and free shipping above the threshold", () => {
    const estimate = estimateOrderTotals([line({ price: 100, quantity: 2 })]);
    expect(estimate.subtotalCents).toBe(20000);
    expect(estimate.discountCents).toBe(0);
    expect(estimate.shippingCents).toBe(0);
    expect(estimate.taxCents).toBe(1650);
    expect(estimate.totalCents).toBe(21650);
  });

  it("applies flat shipping below the free-shipping threshold", () => {
    const estimate = estimateOrderTotals([line({ price: 10, quantity: 1 })]);
    expect(estimate.subtotalCents).toBe(1000);
    expect(estimate.shippingCents).toBe(599);
    expect(estimate.taxCents).toBe(60);
    expect(estimate.totalCents).toBe(1659);
  });

  it("returns a zero estimate for an empty cart", () => {
    expect(estimateOrderTotals([])).toMatchObject({
      subtotalCents: 0,
      discountCents: 0,
      taxCents: 0,
      shippingCents: 0,
      totalCents: 0,
    });
  });
});
