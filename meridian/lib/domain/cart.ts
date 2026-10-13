import {
  fromCents,
  percentageOfCents,
  roundCents,
  sumCents,
  toCents,
  type Cents,
} from "./money";
import { discountedPriceCents, discountAmountCents } from "./pricing";
import { maxOrderableQuantity } from "./inventory";

/**
 * Cart math for Meridian Commerce OS.
 *
 * A {@link CartLine} is the canonical local cart shape shared by client state and
 * the domain layer. It stores the pre-discount unit `price` and a percent
 * `discountPercentage` exactly like a DummyJSON product, so pricing stays
 * consistent between remote sample data and locally edited products.
 *
 * Every function here is pure and uses the integer-cent money strategy; amounts
 * are converted to cents at the boundary and returned as currency units only by
 * the explicitly named convenience helpers.
 */

export interface CartLine {
  /** DummyJSON product id, or a locally generated negative id for local products. */
  productId: number;
  /** Display title captured at add-to-cart time. */
  title: string;
  /** Thumbnail URL captured at add-to-cart time. */
  thumbnail: string;
  /** Pre-discount unit price in currency units. */
  price: number;
  /** Discount percentage on a 0-100 scale. */
  discountPercentage: number;
  /** Quantity in whole units. */
  quantity: number;
  /**
   * Minimum order quantity (MOQ) captured at add-to-cart time, when known.
   * Optional: domain math ignores it, but the cart UI clamps quantity steppers
   * so a bulk-only product is never ordered below its minimum.
   */
  minimumOrderQuantity?: number;
  /**
   * Available stock captured at add-to-cart time, when known. Optional: the
   * cart UI clamps quantity steppers so a line never exceeds what is on hand.
   */
  stock?: number;
}

/** Coerce a quantity into a non-negative whole number; invalid input is 0. */
export function normalizeQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 0;
  return Math.max(0, Math.floor(quantity));
}

/** Pre-discount line subtotal in cents (`price * quantity`). */
export function lineSubtotalCents(line: CartLine): Cents {
  return roundCents(toCents(line.price) * normalizeQuantity(line.quantity));
}

/** Discount amount for a whole line in cents. */
export function lineDiscountCents(line: CartLine): Cents {
  const perUnit = discountAmountCents(toCents(line.price), line.discountPercentage);
  return roundCents(perUnit * normalizeQuantity(line.quantity));
}

/** Discounted line total in cents (`discountedPrice * quantity`). */
export function lineTotalCents(line: CartLine): Cents {
  const perUnit = discountedPriceCents(toCents(line.price), line.discountPercentage);
  return roundCents(perUnit * normalizeQuantity(line.quantity));
}

/** Pre-discount line subtotal in currency units. */
export function lineSubtotal(line: CartLine): number {
  return fromCents(lineSubtotalCents(line));
}

/** Discount amount for a whole line in currency units. */
export function lineDiscount(line: CartLine): number {
  return fromCents(lineDiscountCents(line));
}

/** Discounted line total in currency units. */
export function lineTotal(line: CartLine): number {
  return fromCents(lineTotalCents(line));
}

/** Sum of pre-discount line subtotals, in cents. */
export function cartSubtotalCents(lines: readonly CartLine[]): Cents {
  return sumCents(lines.map(lineSubtotalCents));
}

/** Sum of all line discounts, in cents. */
export function cartDiscountCents(lines: readonly CartLine[]): Cents {
  return sumCents(lines.map(lineDiscountCents));
}

/** Sum of discounted line totals, in cents. */
export function cartDiscountedTotalCents(lines: readonly CartLine[]): Cents {
  return sumCents(lines.map(lineTotalCents));
}

/** Sum of pre-discount line subtotals, in currency units. */
export function cartSubtotal(lines: readonly CartLine[]): number {
  return fromCents(cartSubtotalCents(lines));
}

/** Sum of all line discounts, in currency units. */
export function cartDiscount(lines: readonly CartLine[]): number {
  return fromCents(cartDiscountCents(lines));
}

/** Sum of discounted line totals, in currency units. */
export function cartDiscountedTotal(lines: readonly CartLine[]): number {
  return fromCents(cartDiscountedTotalCents(lines));
}

/** Total number of units across all lines (quantity sum). */
export function cartItemCount(lines: readonly CartLine[]): number {
  return lines.reduce((count, line) => count + normalizeQuantity(line.quantity), 0);
}

/** Number of distinct lines in the cart. */
export function cartLineCount(lines: readonly CartLine[]): number {
  return lines.length;
}

/**
 * Minimum purchasable quantity for a line: its MOQ, or 1 when unknown. The
 * cart record carries the MOQ captured at add-to-cart time so a bulk-only
 * product is never stepped below its minimum.
 */
export function minimumLineQuantity(line: CartLine): number {
  const moq = line.minimumOrderQuantity;
  return typeof moq === "number" && Number.isFinite(moq) && moq > 0
    ? Math.floor(moq)
    : 1;
}

/**
 * Maximum purchasable quantity for a line: the largest MOQ multiple that fits
 * within the captured stock, or `Infinity` when stock is unknown.
 */
export function maximumLineQuantity(line: CartLine): number {
  const { stock } = line;
  if (typeof stock !== "number" || !Number.isFinite(stock)) {
    return Number.POSITIVE_INFINITY;
  }
  const max = maxOrderableQuantity({
    stock,
    minimumOrderQuantity: line.minimumOrderQuantity,
  });
  return Math.max(minimumLineQuantity(line), max);
}

/**
 * Clamp an arbitrary quantity into a line's purchasable range. Non-finite or
 * non-positive input resolves to the line minimum.
 */
export function clampLineQuantity(line: CartLine, quantity: number): number {
  const minimum = minimumLineQuantity(line);
  if (!Number.isFinite(quantity) || quantity <= 0) return minimum;
  const maximum = maximumLineQuantity(line);
  return Math.min(maximum, Math.max(minimum, Math.floor(quantity)));
}

/* -------------------------------------------------------------------------- */
/* DEMO estimates — NOT real commerce rules                                   */
/* -------------------------------------------------------------------------- */

/**
 * The following shipping and tax helpers produce DEMONSTRATION estimates only.
 * They are intentionally simple, deterministic thresholds used to exercise the
 * checkout UI; they are not tax law, carrier rates, or a real pricing engine and
 * must be labeled as estimates wherever they are displayed.
 */

export const FREE_SHIPPING_THRESHOLD_CENTS: Cents = 5000;
export const FLAT_SHIPPING_CENTS: Cents = 599;

/** DEMO shipping estimate in cents for a given discounted subtotal. */
export function estimateShippingCents(discountedSubtotalCents: Cents): Cents {
  const subtotal = roundCents(discountedSubtotalCents);
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
}

/** DEMO tax ladder: each tier is a half-open range `[0, upTo) -> ratePercent`. */
export const DEMO_TAX_TIERS: readonly { upToCents: Cents; ratePercent: number }[] = [
  { upToCents: 2000, ratePercent: 6 },
  { upToCents: 10000, ratePercent: 7 },
  { upToCents: Number.POSITIVE_INFINITY, ratePercent: 8.25 },
];

/** DEMO tax rate (percent) selected by the discounted subtotal ladder. */
export function estimateTaxRatePercent(discountedSubtotalCents: Cents): number {
  const subtotal = roundCents(discountedSubtotalCents);
  if (subtotal <= 0) return 0;
  for (const tier of DEMO_TAX_TIERS) {
    if (subtotal < tier.upToCents) return tier.ratePercent;
  }
  return DEMO_TAX_TIERS[DEMO_TAX_TIERS.length - 1].ratePercent;
}

/** DEMO tax estimate in cents, applied to the discounted subtotal. */
export function estimateTaxCents(discountedSubtotalCents: Cents): Cents {
  const subtotal = roundCents(discountedSubtotalCents);
  if (subtotal <= 0) return 0;
  return percentageOfCents(subtotal, estimateTaxRatePercent(subtotal));
}

export interface OrderEstimate {
  /** Pre-discount subtotal, in cents. */
  subtotalCents: Cents;
  /** Total discount applied across lines, in cents. */
  discountCents: Cents;
  /** Discounted merchandise subtotal, in cents. */
  discountedSubtotalCents: Cents;
  /** DEMO shipping estimate, in cents. */
  shippingCents: Cents;
  /** DEMO tax estimate, in cents. */
  taxCents: Cents;
  /** Grand total (`discountedSubtotal + shipping + tax`), in cents. */
  totalCents: Cents;
  /** DEMO tax rate applied, in percent. */
  taxRatePercent: number;
  /** Total units in the order. */
  itemCount: number;
}

/**
 * Compute a full DEMO order estimate for a set of cart lines. Deterministic and
 * pure; all amounts are integer cents.
 */
export function estimateOrderTotals(lines: readonly CartLine[]): OrderEstimate {
  const subtotalCents = cartSubtotalCents(lines);
  const discountCents = cartDiscountCents(lines);
  const discountedSubtotalCents = cartDiscountedTotalCents(lines);
  const shippingCents = estimateShippingCents(discountedSubtotalCents);
  const taxRatePercent = estimateTaxRatePercent(discountedSubtotalCents);
  const taxCents = estimateTaxCents(discountedSubtotalCents);
  const totalCents = roundCents(discountedSubtotalCents + shippingCents + taxCents);

  return {
    subtotalCents,
    discountCents,
    discountedSubtotalCents,
    shippingCents,
    taxCents,
    totalCents,
    taxRatePercent,
    itemCount: cartItemCount(lines),
  };
}
