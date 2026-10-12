import { describe, expect, it } from "vitest";

import {
  FLAT_SHIPPING_CENTS,
  FREE_SHIPPING_THRESHOLD_CENTS,
  cartDiscountCents,
  cartDiscountedTotal,
  cartDiscountedTotalCents,
  cartItemCount,
  cartLineCount,
  cartSubtotal,
  cartSubtotalCents,
  estimateOrderTotals,
  estimateShippingCents,
  estimateTaxCents,
  estimateTaxRatePercent,
  lineDiscount,
  lineDiscountCents,
  lineSubtotal,
  lineSubtotalCents,
  lineTotal,
  lineTotalCents,
  normalizeQuantity,
  type CartLine,
} from "@/lib/domain/cart";

/** 9.99 @ 10.48% off, 2 units: discounted unit 8.94. */
const lineA: CartLine = {
  productId: 1,
  title: "Essence Mascara Lash Princess",
  thumbnail: "a.webp",
  price: 9.99,
  discountPercentage: 10.48,
  quantity: 2,
};

/** 24.50, no discount, 1 unit. */
const lineB: CartLine = {
  productId: 2,
  title: "Eyeshadow Palette with Mirror",
  thumbnail: "b.webp",
  price: 24.5,
  discountPercentage: 0,
  quantity: 1,
};

/** 42.00, 100% off, 3 units (free). */
const lineC: CartLine = {
  productId: 3,
  title: "Powder Canister",
  thumbnail: "c.webp",
  price: 42,
  discountPercentage: 100,
  quantity: 3,
};

describe("cart.normalizeQuantity", () => {
  it("floors positive quantities to whole units", () => {
    expect(normalizeQuantity(1)).toBe(1);
    expect(normalizeQuantity(2.9)).toBe(2);
    expect(normalizeQuantity(0)).toBe(0);
  });

  it("clamps negative quantities to zero", () => {
    expect(normalizeQuantity(-3)).toBe(0);
    expect(normalizeQuantity(-0.5)).toBe(0);
  });

  it("treats non-finite quantities as zero", () => {
    expect(normalizeQuantity(Number.NaN)).toBe(0);
    expect(normalizeQuantity(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("cart.line* cent helpers", () => {
  it("computes pre-discount subtotal, discount and discounted total per line", () => {
    expect(lineSubtotalCents(lineA)).toBe(1998);
    expect(lineDiscountCents(lineA)).toBe(210);
    expect(lineTotalCents(lineA)).toBe(1788);
  });

  it("handles a no-discount line", () => {
    expect(lineSubtotalCents(lineB)).toBe(2450);
    expect(lineDiscountCents(lineB)).toBe(0);
    expect(lineTotalCents(lineB)).toBe(2450);
  });

  it("handles a fully discounted line (free)", () => {
    expect(lineSubtotalCents(lineC)).toBe(12600);
    expect(lineDiscountCents(lineC)).toBe(12600);
    expect(lineTotalCents(lineC)).toBe(0);
  });

  it("multiplies a per-unit discount by quantity, not the rounded line", () => {
    const single: CartLine = { ...lineB, price: 5, discountPercentage: 33.33, quantity: 3 };
    // per-unit discount = round(500 * 33.33 / 100) = 167; * 3 = 501
    expect(lineDiscountCents(single)).toBe(501);
  });

  it("returns zero for a zero-quantity line", () => {
    const empty: CartLine = { ...lineA, quantity: 0 };
    expect(lineSubtotalCents(empty)).toBe(0);
    expect(lineDiscountCents(empty)).toBe(0);
    expect(lineTotalCents(empty)).toBe(0);
  });
});

describe("cart.line* currency-unit helpers", () => {
  it("projects the cent helpers into currency units", () => {
    expect(lineSubtotal(lineA)).toBe(19.98);
    expect(lineDiscount(lineA)).toBe(2.1);
    expect(lineTotal(lineA)).toBe(17.88);
  });
});

describe("cart.cart* aggregates", () => {
  const cart = [lineA, lineB];

  it("sums pre-discount subtotals across lines", () => {
    expect(cartSubtotalCents(cart)).toBe(4448);
    expect(cartSubtotal(cart)).toBe(44.48);
  });

  it("sums discounts across lines", () => {
    expect(cartDiscountCents(cart)).toBe(210);
  });

  it("sums discounted line totals across lines", () => {
    expect(cartDiscountedTotalCents(cart)).toBe(4238);
    expect(cartDiscountedTotal(cart)).toBe(42.38);
  });

  it("counts total units (quantity sum) not distinct lines", () => {
    expect(cartItemCount(cart)).toBe(3);
    expect(cartLineCount(cart)).toBe(2);
  });

  it("is zero across every aggregate for an empty cart", () => {
    expect(cartSubtotalCents([])).toBe(0);
    expect(cartDiscountCents([])).toBe(0);
    expect(cartDiscountedTotalCents([])).toBe(0);
    expect(cartItemCount([])).toBe(0);
    expect(cartLineCount([])).toBe(0);
  });
});

describe("cart DEMO shipping estimate", () => {
  it("charges nothing for an empty or zero subtotal", () => {
    expect(estimateShippingCents(0)).toBe(0);
    expect(estimateShippingCents(-100)).toBe(0);
  });

  it("charges the flat rate below the free-shipping threshold", () => {
    expect(FREE_SHIPPING_THRESHOLD_CENTS).toBe(5000);
    expect(FLAT_SHIPPING_CENTS).toBe(599);
    expect(estimateShippingCents(4999)).toBe(FLAT_SHIPPING_CENTS);
  });

  it("is free at or above the threshold", () => {
    expect(estimateShippingCents(5000)).toBe(0);
    expect(estimateShippingCents(5001)).toBe(0);
  });
});

describe("cart DEMO tax estimate", () => {
  it("uses the 6% tier below 2000 cents", () => {
    expect(estimateTaxRatePercent(0)).toBe(0);
    expect(estimateTaxRatePercent(1999)).toBe(6);
    expect(estimateTaxCents(1999)).toBe(120);
  });

  it("uses the 7% tier for [2000, 10000)", () => {
    expect(estimateTaxRatePercent(2000)).toBe(7);
    expect(estimateTaxRatePercent(9999)).toBe(7);
    expect(estimateTaxCents(2000)).toBe(140);
  });

  it("uses the 8.25% tier at or above 10000 cents", () => {
    expect(estimateTaxRatePercent(10000)).toBe(8.25);
    expect(estimateTaxCents(10000)).toBe(825);
  });

  it("levies no tax on a non-positive subtotal", () => {
    expect(estimateTaxRatePercent(0)).toBe(0);
    expect(estimateTaxCents(0)).toBe(0);
    expect(estimateTaxCents(-500)).toBe(0);
  });
});

describe("cart.estimateOrderTotals", () => {
  it("aggregates subtotal, discount, shipping, tax and grand total", () => {
    const estimate = estimateOrderTotals([lineA, lineB]);
    expect(estimate).toEqual({
      subtotalCents: 4448,
      discountCents: 210,
      discountedSubtotalCents: 4238,
      shippingCents: 599,
      taxCents: 297,
      totalCents: 5134,
      taxRatePercent: 7,
      itemCount: 3,
    });
  });

  it("waives shipping and totals zero on a fully-discounted cart", () => {
    const estimate = estimateOrderTotals([lineC]);
    expect(estimate.subtotalCents).toBe(12600);
    expect(estimate.discountCents).toBe(12600);
    expect(estimate.discountedSubtotalCents).toBe(0);
    expect(estimate.shippingCents).toBe(0);
    expect(estimate.taxCents).toBe(0);
    expect(estimate.totalCents).toBe(0);
    expect(estimate.itemCount).toBe(3);
  });

  it("returns an all-zero estimate for an empty cart", () => {
    const estimate = estimateOrderTotals([]);
    expect(estimate.totalCents).toBe(0);
    expect(estimate.itemCount).toBe(0);
    expect(estimate.taxRatePercent).toBe(0);
  });

  it("composes total as discountedSubtotal + shipping + tax", () => {
    const estimate = estimateOrderTotals([lineB]);
    expect(estimate.totalCents).toBe(
      estimate.discountedSubtotalCents + estimate.shippingCents + estimate.taxCents,
    );
  });
});
