import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createSafePersistStorage,
  STORAGE_KEYS,
  STORAGE_VERSION,
} from "./persistence";

/**
 * Wishlist (saved items) client state.
 *
 * Only product ids are stored, never remote product snapshots: the canonical
 * product data always comes from the API/query layer, so a wishlist can never
 * pin stale remote sample data into persisted local state. Ids are local user
 * choices and survive refresh.
 */
export interface WishlistState {
  /** Saved product ids, insertion-ordered, de-duplicated. */
  ids: number[];
  /** Add a product id if not present (no-op when already saved). */
  add: (productId: number) => void;
  /** Remove a product id. */
  remove: (productId: number) => void;
  /** Add when absent, remove when present. */
  toggle: (productId: number) => void;
  /** Clear the wishlist. */
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set) => ({
      ids: [],
      add: (productId) =>
        set((state) =>
          state.ids.includes(productId)
            ? state
            : { ids: [...state.ids, productId] },
        ),
      remove: (productId) =>
        set((state) => ({
          ids: state.ids.filter((id) => id !== productId),
        })),
      toggle: (productId) =>
        set((state) => ({
          ids: state.ids.includes(productId)
            ? state.ids.filter((id) => id !== productId)
            : [...state.ids, productId],
        })),
      clear: () => set({ ids: [] }),
    }),
    {
      name: STORAGE_KEYS.wishlist,
      version: STORAGE_VERSION,
      storage: createSafePersistStorage<WishlistState>(),
      skipHydration: true,
    },
  ),
);

export const selectWishlistIds = (state: WishlistState): number[] => state.ids;

export const selectWishlistCount = (state: WishlistState): number =>
  state.ids.length;

export const selectIsWishlisted =
  (productId: number) =>
  (state: WishlistState): boolean =>
    state.ids.includes(productId);
