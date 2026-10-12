import {
  fromCents,
  percentageOfCents,
  toCents,
  type Cents,
} from "./money";

/**
 * Pricing math matching DummyJSON product fields.
 *
 * `Product.price` is the pre-discount unit price and `Product.discountPercentage`
 * is a percentage on a 0-100 scale (e.g. `10.5` meaning 10.5%). DummyJSON defines:
 *
 *   discountAmount  = price * discountPercentage / 100
 *   discountedPrice = price - discountAmount
 *
 * These helpers reproduce that contract using the integer-cent money strategy so
 * results are deterministic and agree with the values returned by the API.
 */

/** Discount percentages are clamped to this closed range before use. */
export const DISCOUNT_PERCENT_MIN = 0;
export const DISCOUNT_PERCENT_MAX = 100;

/**
 * Clamp a discount percentage into the valid 0-100 range.
 * Non-finite input degrades to 0 rather than throwing, because discount data is
 * remote input that must never crash a render.
 */
export function clampDiscountPercent(percent: number): number {
  if (!Number.isFinite(percent)) return DISCOUNT_PERCENT_MIN;
  return Math.min(
    DISCOUNT_PERCENT_MAX,
    Math.max(DISCOUNT_PERCENT_MIN, percent),
  );
}

/** Discount amount in integer cents for a cent price and a percent discount. */
export function discountAmountCents(
  priceCents: Cents,
  discountPercent: number,
): Cents {
  return percentageOfCents(priceCents, clampDiscountPercent(discountPercent));
}

/**
 * Discounted unit price in integer cents: the price minus its discount, never
 * below zero.
 */
export function discountedPriceCents(
  priceCents: Cents,
  discountPercent: number,
): Cents {
  const discounted = priceCents - discountAmountCents(priceCents, discountPercent);
  return discounted < 0 ? 0 : discounted;
}

/** Discount amount in currency units for a currency-unit price and percent. */
export function discountAmount(
  price: number,
  discountPercent: number,
): number {
  return fromCents(discountAmountCents(toCents(price), discountPercent));
}

/** Discounted unit price in currency units for a currency-unit price/percent. */
export function discountedPrice(
  price: number,
  discountPercent: number,
): number {
  return fromCents(discountedPriceCents(toCents(price), discountPercent));
}

/** Minimal shape needed to price a product line. */
export interface PricedProduct {
  price: number;
  discountPercentage: number;
}

/** Discount amount (cents) for a DummyJSON-shaped product. */
export function productDiscountAmountCents(product: PricedProduct): Cents {
  return discountAmountCents(toCents(product.price), product.discountPercentage);
}

/** Discounted unit price (cents) for a DummyJSON-shaped product. */
export function productDiscountedPriceCents(product: PricedProduct): Cents {
  return discountedPriceCents(toCents(product.price), product.discountPercentage);
}

/** Effective unit price (cents) — falls back to the undiscounted price. */
export function effectiveUnitPriceCents(product: PricedProduct): Cents {
  return productDiscountedPriceCents(product);
}

/** Whether a product carries a real, positive discount. */
export function hasDiscount(product: PricedProduct): boolean {
  return clampDiscountPercent(product.discountPercentage) > DISCOUNT_PERCENT_MIN;
}
