import { useCartStore } from "./cart-store";
import { useWishlistStore } from "./wishlist-store";
import { useOverridesStore } from "./overrides-store";
import { useCreatedProductsStore } from "./created-products-store";
import { useMerchandisingStore } from "./merchandising-store";
import { useOrdersStore } from "./orders-store";
import { usePreferencesStore } from "./preferences-store";

export { useCartStore } from "./cart-store";
export * from "./cart-store";
export { useWishlistStore } from "./wishlist-store";
export * from "./wishlist-store";
export { useOverridesStore } from "./overrides-store";
export * from "./overrides-store";
export { useCreatedProductsStore } from "./created-products-store";
export * from "./created-products-store";
export { useMerchandisingStore } from "./merchandising-store";
export * from "./merchandising-store";
export { useOrdersStore } from "./orders-store";
export * from "./orders-store";
export { usePreferencesStore } from "./preferences-store";
export * from "./preferences-store";
export {
  createSafePersistStorage,
  STORAGE_KEYS,
  STORAGE_VERSION,
} from "./persistence";
export type { StorageKey } from "./persistence";

/**
 * Every persisted Meridian store, in a stable order. Centralized so the client
 * hydration hook rehydrates all of them through one guarded entry point and no
 * store is accidentally forgotten.
 */
const PERSISTED_STORES = [
  useCartStore,
  useWishlistStore,
  useOverridesStore,
  useCreatedProductsStore,
  useMerchandisingStore,
  useOrdersStore,
  usePreferencesStore,
] as const;

/**
 * Rehydrate every persisted store from browser storage.
 *
 * SSR-safe: returns immediately with no side effects when `window` is
 * undefined, so it never touches `localStorage` on the server. Each store's
 * rehydrate runs inside its own try/catch so a single failing store cannot
 * abort the others, and the failure-tolerant storage layer keeps read errors
 * from throwing in the first place.
 */
export async function rehydrateAllStores(): Promise<void> {
  if (typeof window === "undefined") return;
  await Promise.all(
    PERSISTED_STORES.map(async (store) => {
      try {
        await store.persist.rehydrate();
      } catch {
        // Degrade to in-memory state; never crash on rehydration.
      }
    }),
  );
}
