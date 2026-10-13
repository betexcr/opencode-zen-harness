import { useWishlistStore, type WishlistState } from "@/lib/state";

/**
 * Wishlist interaction helpers.
 *
 * Saved items live in the persisted `useWishlistStore` (product ids only). These
 * helpers are the single surface product-detail views and any wishlist control
 * use to mutate it, so `add` / `remove` / `toggle` are expressed once and the
 * persisted store stays the only source of truth.
 *
 * Nothing here creates state: every helper delegates to the existing store
 * actions (`add`, `remove`, `toggle`, `clear`). The pure helpers take an
 * explicit action surface so they can be unit-tested without mounting React;
 * `wishlistActions` binds them to the live persisted store for components.
 */

/** The wishlist-store fields and actions the helpers delegate to. */
export type WishlistActionSurface = Pick<
  WishlistState,
  "ids" | "add" | "remove" | "toggle" | "clear"
>;

/** Whether `productId` is currently saved. */
export function isWishlisted(
  ids: readonly number[],
  productId: number,
): boolean {
  return ids.includes(productId);
}

/** Save a product id (no-op when already present). Delegates to `add`. */
export function addToWishlist(
  actions: WishlistActionSurface,
  productId: number,
): void {
  actions.add(productId);
}

/** Remove a product id. Delegates to `remove`. */
export function removeFromWishlist(
  actions: WishlistActionSurface,
  productId: number,
): void {
  actions.remove(productId);
}

/**
 * Toggle a product id and return its new saved state. Delegates to `toggle`
 * (add when absent, remove when present).
 */
export function toggleWishlistItem(
  actions: WishlistActionSurface,
  productId: number,
): boolean {
  const wasSaved = isWishlisted(actions.ids, productId);
  actions.toggle(productId);
  return !wasSaved;
}

/** Remove every saved id. Delegates to `clear`. */
export function clearWishlist(actions: WishlistActionSurface): void {
  actions.clear();
}

/** The bound wishlist surface components call. */
export interface WishlistActions {
  add: (productId: number) => void;
  remove: (productId: number) => void;
  toggle: (productId: number) => boolean;
  clear: () => void;
  isWishlisted: (productId: number) => boolean;
}

/**
 * Single mutation surface for the wishlist, bound to the persisted
 * `useWishlistStore`. Components call `wishlistActions.toggle(...)`,
 * `wishlistActions.isWishlisted(...)`, and so on rather than reaching into the
 * store directly.
 */
export const wishlistActions: WishlistActions = {
  add: (productId) => addToWishlist(useWishlistStore.getState(), productId),
  remove: (productId) =>
    removeFromWishlist(useWishlistStore.getState(), productId),
  toggle: (productId) =>
    toggleWishlistItem(useWishlistStore.getState(), productId),
  clear: () => clearWishlist(useWishlistStore.getState()),
  isWishlisted: (productId) =>
    isWishlisted(useWishlistStore.getState().ids, productId),
};
