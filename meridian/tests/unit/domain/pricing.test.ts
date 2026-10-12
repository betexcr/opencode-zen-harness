import { describe, expect, it } from "vitest";

import {
  DISCOUNT_PERCENT_MAX,
  DISCOUNT_PERCENT_MIN,
  clampDiscountPercent,
  discountAmount,
  discountAmountCents,
  discountedPrice,
  discountedPriceCents,
  effectiveUnitPriceCents,
  hasDiscount,
  productDiscountAmountCents,
  productDiscountedPriceCents,
  type PricedProduct,
} from "@/lib/domain/pricing";

/**
 * Verified DummyJSON shape for product id 1 (Essence Mascara Lash Princess):
 * price 9.99, discountPercentage 10.48. The API's own `discountedTotal` is
 * 8.94, so the integer-cent helpers must reproduce that exactly.
 */
const mascara: PricedProduct = { price: 9.99, discountPercentage: 10.48 };

const noDiscount: PricedProduct = { price: 24.5, discountPercentage: 0 };

const fullDiscount: PricedProduct = { price: 42.0, discountPercentage: 100 };

describe("pricing.clampDiscountPercent", () => {
  it("leaves in-range percentages untouched", () => {
    expect(clampDiscountPercent(0)).toBe(DISCOUNT_PERCENT_MIN);
    expect(clampDiscountPercent(10.48)).toBeCloseTo(10.48, 10);
    expect(clampDiscountPercent(100)).toBe(DISCOUNT_PERCENT_MAX);
  });

  it("clamps out-of-range percentages into [0, 100]", () => {
    expect(clampDiscountPercent(-5)).toBe(0);
    expect(clampDiscountPercent(140)).toBe(100);
  });

  it("degrades non-finite input to zero instead of throwing", () => {
    expect(clampDiscountPercent(Number.NaN)).toBe(0);
    expect(clampDiscountPercent(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampDiscountPercent(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("pricing.discountAmountCents / discountedPriceCents", () => {
  it("matches the verified DummyJSON discounted price (9.99 @ 10.48% -> 8.94)", () => {
    expect(discountAmountCents(999, 10.48)).toBe(105);
    expect(discountedPriceCents(999, 10.48)).toBe(894);
  });

  it("is a no-op for a zero discount", () => {
    expect(discountAmountCents(2450, 0)).toBe(0);
    expect(discountedPriceCents(2450, 0)).toBe(2450);
  });

  it("zeroes the discounted price at a full 100% discount", () => {
    expect(discountAmountCents(4200, 100)).toBe(4200);
    expect(discountedPriceCents(4200, 100)).toBe(0);
  });

  it("never returns a negative discounted price", () => {
    expect(discountedPriceCents(500, 150)).toBe(0);
  });

  it("treats negative discounts as zero (clamped)", () => {
    expect(discountAmountCents(1000, -20)).toBe(0);
    expect(discountedPriceCents(1000, -20)).toBe(1000);
  });
});

describe("pricing.discountAmount / discountedPrice (currency units)", () => {
  it("produces currency-unit results consistent with the cent helpers", () => {
    expect(discountAmount(9.99, 10.48)).toBe(1.05);
    expect(discountedPrice(9.99, 10.48)).toBe(8.94);
  });

  it("handles clean integer money", () => {
    expect(discountedPrice(100, 25)).toBe(75);
    expect(discountAmount(100, 25)).toBe(25);
  });

  it("is identity with no discount", () => {
    expect(discountedPrice(24.5, 0)).toBe(24.5);
    expect(discountAmount(24.5, 0)).toBe(0);
  });
});

describe("pricing.product* helpers", () => {
  it("reproduces verified DummyJSON values for the mascara product", () => {
    expect(productDiscountAmountCents(mascara)).toBe(105);
    expect(productDiscountedPriceCents(mascara)).toBe(894);
    expect(effectiveUnitPriceCents(mascara)).toBe(894);
  });

  it("effective unit price equals the undiscounted price with no discount", () => {
    expect(effectiveUnitPriceCents(noDiscount)).toBe(2450);
  });

  it("effective unit price is zero for a fully discounted product", () => {
    expect(effectiveUnitPriceCents(fullDiscount)).toBe(0);
  });
});

describe("pricing.hasDiscount", () => {
  it("is false with no discount and true with a positive discount", () => {
    expect(hasDiscount(noDiscount)).toBe(false);
    expect(hasDiscount(mascara)).toBe(true);
    expect(hasDiscount(fullDiscount)).toBe(true);
  });

  it("is false for negative or non-finite discounts", () => {
    expect(hasDiscount({ price: 10, discountPercentage: -5 })).toBe(false);
    expect(hasDiscount({ price: 10, discountPercentage: Number.NaN })).toBe(false);
  });
});
