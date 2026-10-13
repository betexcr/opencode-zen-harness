import {
  estimateOrderTotals,
  type CartLine,
  type OrderEstimate,
} from "@/lib/domain/cart";
import type { OrderStatus } from "@/lib/state/orders-store";
import type { CheckoutValues } from "@/lib/validation/checkout";

/**
 * Pure order builder for the demo checkout flow.
 *
 * Turning a completed checkout form into an order is business logic, not UI, so
 * it lives here as a pure function: no React, no stores, no I/O. The wizard
 * supplies the cart lines, the validated checkout values, and a timestamp (so
 * the result is deterministic and trivially unit-testable) and receives an
 * immutable {@link OrderSnapshot} back.
 *
 * The snapshot captures the merchandising identity of every line, the frozen
 * DEMO totals from `estimateOrderTotals`, and a demo summary of the contact,
 * shipping, and payment fields. The raw card number is never retained — only its
 * last four digits survive, and the payment record is explicitly flagged as a
 * demonstration. The orders store persists the `lines`, `estimate`, `placedAt`,
 * and `status` fields through its `placeOrder` action; the contact/shipping/
 * payment summary travels with the snapshot so callers have one complete,
 * self-describing order object.
 */

/** Contact fields captured on a placed order. */
export interface OrderContactSnapshot {
  fullName: string;
  email: string;
  phone: string;
}

/** Shipping address captured on a placed order. */
export interface OrderShippingSnapshot {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

/** Demo payment summary captured on a placed order (never the full card). */
export interface OrderPaymentSnapshot {
  cardName: string;
  /** Last four digits of the demo card; the full number is never stored. */
  cardLast4: string;
  expiry: string;
  /** Always `true`: this is a demonstration, not a payment record. */
  demo: true;
}

/** Immutable snapshot of one placed demo order. */
export interface OrderSnapshot {
  /** Copied cart lines at placement time. */
  lines: CartLine[];
  /** DEMO totals frozen from {@link estimateOrderTotals}. */
  estimate: OrderEstimate;
  /** Contact details captured at placement. */
  contact: OrderContactSnapshot;
  /** Shipping address captured at placement. */
  shipping: OrderShippingSnapshot;
  /** Demo payment summary captured at placement. */
  payment: OrderPaymentSnapshot;
  /** ISO timestamp captured at placement (caller-supplied for purity). */
  placedAt: string;
  /** Local order status; a fresh order is always `"placed"`. */
  status: OrderStatus;
}

/** Inputs the builder needs to produce an {@link OrderSnapshot}. */
export interface CreateOrderInput {
  /** Cart lines to snapshot. */
  lines: readonly CartLine[];
  /** Validated checkout form values. */
  values: CheckoutValues;
  /** ISO timestamp captured by the caller at placement time. */
  placedAt: string;
}

/** Copy a line so a placed order never aliases mutable cart state. */
function cloneLine(line: CartLine): CartLine {
  const clone: CartLine = {
    productId: line.productId,
    title: line.title,
    thumbnail: line.thumbnail,
    price: line.price,
    discountPercentage: line.discountPercentage,
    quantity: line.quantity,
  };
  if (line.minimumOrderQuantity !== undefined) {
    clone.minimumOrderQuantity = line.minimumOrderQuantity;
  }
  if (line.stock !== undefined) {
    clone.stock = line.stock;
  }
  return clone;
}

/** Last four digits of a card number, tolerating spaces and punctuation. */
function lastFourDigits(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  return digits.length <= 4 ? digits : digits.slice(-4);
}

/**
 * Build an immutable order snapshot from a cart and validated checkout values.
 *
 * Pure and deterministic: the same inputs always produce the same snapshot, and
 * the caller owns the timestamp. Nothing is persisted here — the wizard hands
 * the snapshot to the orders store and clears the cart.
 */
export function createOrderSnapshot(input: CreateOrderInput): OrderSnapshot {
  const lines = input.lines.map(cloneLine);
  const { values } = input;

  return {
    lines,
    estimate: estimateOrderTotals(lines),
    contact: {
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
    },
    shipping: {
      fullName: values.fullName,
      line1: values.line1,
      line2: values.line2 ?? "",
      city: values.city,
      region: values.region,
      postalCode: values.postalCode,
      country: values.country,
    },
    payment: {
      cardName: values.cardName,
      cardLast4: lastFourDigits(values.cardNumber),
      expiry: values.expiry,
      demo: true,
    },
    placedAt: input.placedAt,
    status: "placed",
  };
}
