import type { CartLine, OrderEstimate } from "@/lib/domain/cart";
import { useCartStore, useOrdersStore } from "@/lib/state";
import {
  createOrderSnapshot,
  type CreateOrderInput,
  type OrderSnapshot,
} from "./create-order";

/**
 * Checkout placement helpers.
 *
 * Turning a completed checkout form into a persisted demo order is business
 * logic, not UI, so the composition lives here rather than inline in the wizard:
 * build the immutable snapshot with the pure {@link createOrderSnapshot}, hand
 * it to the persisted orders store, and clear the completed cart. The empty-cart
 * rule is expressed exactly once — checkout never places an order for an empty
 * cart — so the wizard, and any future caller, share one surface.
 *
 * The pure {@link placeCheckoutOrder} takes an explicit action surface so it can
 * be unit-tested without mounting React; `checkoutActions` binds it to the live
 * persisted stores for components.
 */

/** The store actions the checkout helpers delegate to. */
export interface CheckoutPlacementSurface {
  /** Persist an order from its line snapshot; returns the assigned number. */
  placeOrder: (
    lines: readonly CartLine[],
    estimate: OrderEstimate,
    placedAt: string,
  ) => number;
  /** Clear the completed cart. */
  clearCart: () => void;
}

/** A freshly placed demo order: the assigned number plus its full snapshot. */
export interface PlacedCheckoutOrder {
  /** Local order number assigned by the orders store (1-based). */
  number: number;
  /** The immutable snapshot that was persisted. */
  snapshot: OrderSnapshot;
}

/**
 * Build, persist, and clear for a checkout submission.
 *
 * Returns `null` — and touches neither the store nor the cart — when there are
 * no lines to order, so an accidental empty submission is a no-op rather than an
 * empty order. On success the order is persisted first and the cart cleared
 * second, so a failed placement never discards the shopper's cart.
 */
export function placeCheckoutOrder(
  surface: CheckoutPlacementSurface,
  input: CreateOrderInput,
): PlacedCheckoutOrder | null {
  if (input.lines.length === 0) return null;

  const snapshot = createOrderSnapshot(input);
  const number = surface.placeOrder(
    snapshot.lines,
    snapshot.estimate,
    snapshot.placedAt,
  );
  surface.clearCart();

  return { number, snapshot };
}

/** The bound checkout surface components call. */
export interface CheckoutActions {
  /**
   * Place a demo order from the current checkout input. Returns the assigned
   * order and its snapshot, or `null` when the cart is empty.
   */
  placeOrder: (input: CreateOrderInput) => PlacedCheckoutOrder | null;
}

/**
 * Single placement surface for the storefront checkout, bound to the persisted
 * `useOrdersStore` and `useCartStore`. Components call
 * `checkoutActions.placeOrder(...)` rather than reaching into both stores
 * directly, so the empty-cart guard and the persist-then-clear ordering stay
 * centralized here.
 */
export const checkoutActions: CheckoutActions = {
  placeOrder: (input) =>
    placeCheckoutOrder(
      {
        placeOrder: (lines, estimate, placedAt) =>
          useOrdersStore.getState().placeOrder(lines, estimate, placedAt),
        clearCart: () => useCartStore.getState().clear(),
      },
      input,
    ),
};
