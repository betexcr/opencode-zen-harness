/**
 * Money primitives for Meridian Commerce OS.
 *
 * STRATEGY (single, documented): every monetary amount is represented as an
 * INTEGER number of minor units — "cents", i.e. 1/100 of the currency unit.
 * Floating point values coming from DummyJSON (`price`, `total`, `discountedTotal`,
 * etc.) are converted at the boundary with {@link toCents}. All arithmetic after
 * that point is integer arithmetic, which eliminates binary floating point drift
 * (`0.1 + 0.2 !== 0.3`) and makes totals deterministic and safely comparable.
 * Convert back to a display float only at the very end with {@link fromCents}.
 *
 * ROUNDING: half away from zero, applied exactly once per conversion or
 * multiplication so results are stable regardless of operand order.
 */

export type Cents = number;

/** Number of minor units in one whole currency unit. */
export const CENTS_PER_UNIT = 100;

/**
 * Round a raw minor-unit value to the nearest integer, half away from zero.
 * `-0` is normalized to `0` so equality and formatting are predictable.
 *
 * @throws RangeError when `value` is not finite.
 */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot round non-finite monetary value: ${value}`);
  }
  const magnitude = Math.round(Math.abs(value) + Number.EPSILON);
  const rounded = Math.sign(value) * magnitude;
  return rounded === 0 ? 0 : rounded;
}

/**
 * Convert a currency-unit amount (e.g. `19.99`) into integer cents.
 *
 * @throws RangeError when `amount` is not finite.
 */
export function toCents(amount: number): Cents {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Cannot convert non-finite amount to cents: ${amount}`);
  }
  return roundCents(amount * CENTS_PER_UNIT);
}

/** Convert integer cents back into a currency-unit float for display/JSON. */
export function fromCents(cents: Cents): number {
  return roundCents(cents) / CENTS_PER_UNIT;
}

/** Multiply integer cents by a scalar and round the product to whole cents. */
export function multiplyCents(cents: Cents, factor: number): Cents {
  return roundCents(roundCents(cents) * factor);
}

/**
 * Compute `percent` of a cent amount (e.g. tax, discount) and round the result
 * to whole cents. `percent` is expressed on a 0-100 scale (8.25 => 8.25%).
 */
export function percentageOfCents(cents: Cents, percent: number): Cents {
  return roundCents((roundCents(cents) * percent) / 100);
}

/** Sum cent amounts using integer arithmetic. Non-integer inputs are rounded. */
export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const value of values) {
    total += roundCents(value);
  }
  return total;
}

export interface CurrencyFormatOptions {
  /** BCP-47 locale tag. Defaults to `en-US`. */
  locale?: string;
  /** ISO-4217 currency code. Defaults to `USD`. */
  currency?: string;
  /** Fraction digits; defaults to 2 for every currency. */
  fractionDigits?: number;
}

const DEFAULT_LOCALE = "en-US";
const DEFAULT_CURRENCY = "USD";
const DEFAULT_FRACTION_DIGITS = 2;

/**
 * Format integer cents as a localized currency string, e.g. `$19.99`.
 * This is the single supported formatting entry point — callers never format
 * money by hand.
 */
export function formatCurrency(
  cents: Cents,
  options: CurrencyFormatOptions = {},
): string {
  const {
    locale = DEFAULT_LOCALE,
    currency = DEFAULT_CURRENCY,
    fractionDigits = DEFAULT_FRACTION_DIGITS,
  } = options;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(fromCents(cents));
}

/**
 * Convenience formatter for callers that only have a currency-unit amount
 * (e.g. a raw DummyJSON `price`). Converts through the integer-cent strategy
 * first so output is identical to {@link formatCurrency}.
 */
export function formatAmount(
  amount: number,
  options: CurrencyFormatOptions = {},
): string {
  return formatCurrency(toCents(amount), options);
}
