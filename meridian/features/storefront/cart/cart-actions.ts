import { normalizeQuantity, type CartLine } from "@/lib/domain/cart";
import {
  maxOrderableQuantity,
  type InventoryInput,
} from "@/lib/domain/inventory";
import { useCartStore, type CartState } from "@/lib/state";

/**
 * Cart interaction helpers.
 *
 * The persisted cart lives in `useCartStore` and its money math lives in
 * `lib/domain/cart.ts`. This module is the single surface that the catalog,
 * cart page, header drawer, product-detail view, and checkout use to MUTATE the
 * cart, so the rules that keep a line orderable (minimum order quantity and
 * available stock) are expressed exactly once.
 *
 * Nothing here creates state: every helper delegates to the existing store
 * actions (`addLine`, `setQuantity`, `incrementLine`, `decrementLine`,
 * `removeLine`, `clear`) and to the domain math (`normalizeQuantity`,
 * `maxOrderableQuantity`). The pure helpers take an explicit action surface so
 * they can be unit-tested without mounting React; `cartActions` binds them to
 * the live persisted store for components.
 */

/** The cart-store actions the helpers delegate to. */
export type CartActionSurface = Pick<
  CartState,
  | "addLine"
  | "setQuantity"
  | "incrementLine"
  | "decrementLine"
  | "removeLine"
  | "clear"
>;

/**
 * The product fields add-to-cart needs. A full `Product` from
 * `lib/api/schemas` is structurally assignable, so callers pass the product
 * they already have.
 */
export interface CartLineInput {
  id: number;
  title: string;
  thumbnail: string;
  price: number;
  discountPercentage: number;
  stock: number;
  minimumOrderQuantity?: number;
}

/** Lower and upper orderable quantity bounds for a product. */
export interface CartLineBounds {
  /** Minimum order quantity (at least one whole unit). */
  minimum: number;
  /** Largest orderable quantity; `0` when nothing is orderable. */
  maximum: number;
}

/**
 * Resolve a product's minimum order quantity.
 *
 * DummyJSON always ships the field, but it is optional in the domain input and
 * may be absent or zero in merchant-authored data, so it is floored to a
 * minimum of one whole unit.
 */
export function minimumOrderQuantityOf(input: InventoryInput): number {
  const raw = input.minimumOrderQuantity;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
}

/**
 * Orderable quantity bounds for a product, honouring both the minimum order
 * quantity and available stock. `maximum` is `0` when the product cannot be
 * ordered at all (out of stock, or stock below a single minimum order).
 */
export function cartLineBounds(input: InventoryInput): CartLineBounds {
  const minimum = minimumOrderQuantityOf(input);
  const maximum = maxOrderableQuantity(input);
  return { minimum, maximum: maximum < minimum ? 0 : maximum };
}

/**
 * Clamp a requested quantity into a product's orderable range.
 *
 *   - a request below the minimum order quantity is raised to the minimum;
 *   - a request above available stock is capped at `maxOrderableQuantity`;
 *   - an unorderable product yields `0`.
 *
 * The result is always a whole number of units.
 */
export function clampCartQuantity(
  input: InventoryInput,
  requested: number,
): number {
  const { minimum, maximum } = cartLineBounds(input);
  if (maximum < minimum) return 0;
  return Math.min(Math.max(normalizeQuantity(requested), minimum), maximum);
}

/** Build a cart line from a product input and an already-clamped quantity. */
export function toCartLine(input: CartLineInput, quantity: number): CartLine {
  return {
    productId: input.id,
    title: input.title,
    thumbnail: input.thumbnail,
    price: input.price,
    discountPercentage: input.discountPercentage,
    quantity: normalizeQuantity(quantity),
  };
}

/**
 * Add a product to the cart, clamping the quantity to the minimum order
 * quantity and to available stock. Returns the quantity actually added (`0`
 * when the product is not orderable, in which case the cart is left untouched).
 */
export function addToCart(
  actions: CartActionSurface,
  input: CartLineInput,
  requested = 1,
): number {
  const quantity = clampCartQuantity(input, requested);
  if (quantity <= 0) return 0;
  actions.addLine(toCartLine(input, quantity), quantity);
  return quantity;
}

/**
 * Set a line to an absolute quantity, clamped to the product's orderable range.
 * A clamped quantity of `0` removes the line (delegated to `setQuantity`, which
 * drops non-positive quantities). Returns the quantity that was stored.
 */
export function setCartLineQuantity(
  actions: CartActionSurface,
  input: CartLineInput,
  quantity: number,
): number {
  const clamped = clampCartQuantity(input, quantity);
  actions.setQuantity(input.id, clamped);
  return clamped;
}

/** Whether a line can be increased without exceeding available stock. */
export function canIncrementCartLine(
  line: CartLine,
  input: InventoryInput,
): boolean {
  return normalizeQuantity(line.quantity) < maxOrderableQuantity(input);
}

/** Whether a line can be decreased without dropping below its minimum order. */
export function canDecrementCartLine(
  line: CartLine,
  input: InventoryInput,
): boolean {
  return normalizeQuantity(line.quantity) > minimumOrderQuantityOf(input);
}

/**
 * Increase a line's quantity by `step` (default one unit), clamped so it never
 * exceeds available stock. Delegates to `incrementLine`. Returns the resulting
 * quantity.
 */
export function incrementCartLine(
  actions: CartActionSurface,
  line: CartLine,
  input: InventoryInput,
  step = 1,
): number {
  const current = normalizeQuantity(line.quantity);
  const maximum = maxOrderableQuantity(input);
  const increment = Math.max(1, normalizeQuantity(step));
  if (current >= maximum) return current;
  const target = Math.min(current + increment, maximum);
  actions.incrementLine(line.productId, target - current);
  return target;
}

/**
 * Decrease a line's quantity by `step` (default one unit), clamped so it never
 * drops below the minimum order quantity. Delegates to `decrementLine`.
 * Returns the resulting quantity (unchanged when already at the minimum).
 */
export function decrementCartLine(
  actions: CartActionSurface,
  line: CartLine,
  input: InventoryInput,
  step = 1,
): number {
  const current = normalizeQuantity(line.quantity);
  const minimum = minimumOrderQuantityOf(input);
  const decrement = Math.max(1, normalizeQuantity(step));
  const target = Math.max(current - decrement, minimum);
  if (target >= current) return current;
  actions.decrementLine(line.productId, current - target);
  return target;
}

/** Remove a line entirely. Delegates to `removeLine`. */
export function removeCartLine(
  actions: CartActionSurface,
  productId: number,
): void {
  actions.removeLine(productId);
}

/** Remove every line. Delegates to `clear`. */
export function clearCart(actions: CartActionSurface): void {
  actions.clear();
}

/** The bound cart surface components call. */
export interface CartActions {
  add: (input: CartLineInput, requested?: number) => number;
  setQuantity: (input: CartLineInput, quantity: number) => number;
  increment: (line: CartLine, input: InventoryInput, step?: number) => number;
  decrement: (line: CartLine, input: InventoryInput, step?: number) => number;
  remove: (productId: number) => void;
  clear: () => void;
  canIncrement: (line: CartLine, input: InventoryInput) => boolean;
  canDecrement: (line: CartLine, input: InventoryInput) => boolean;
}

/**
 * Single mutation surface for the storefront cart, bound to the persisted
 * `useCartStore`. Components call `cartActions.add(...)`,
 * `cartActions.increment(...)`, and so on rather than reaching into the store
 * directly, so the clamping rules stay centralized in one place.
 */
export const cartActions: CartActions = {
  add: (input, requested) =>
    addToCart(useCartStore.getState(), input, requested),
  setQuantity: (input, quantity) =>
    setCartLineQuantity(useCartStore.getState(), input, quantity),
  increment: (line, input, step) =>
    incrementCartLine(useCartStore.getState(), line, input, step),
  decrement: (line, input, step) =>
    decrementCartLine(useCartStore.getState(), line, input, step),
  remove: (productId) => removeCartLine(useCartStore.getState(), productId),
  clear: () => clearCart(useCartStore.getState()),
  canIncrement: (line, input) => canIncrementCartLine(line, input),
  canDecrement: (line, input) => canDecrementCartLine(line, input),
};
