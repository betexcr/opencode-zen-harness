import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ProductOverride,
  ProductOverridePatch,
} from "@/lib/domain/product";
import {
  createSafePersistStorage,
  STORAGE_KEYS,
  STORAGE_VERSION,
} from "./persistence";

/**
 * Merchant product-override and tombstone state for Meridian Commerce OS.
 *
 * This store owns LOCAL, user-authored edits to REMOTE DummyJSON sample data:
 *
 *   - `overrides`  partial field patches keyed by remote product id.
 *   - `tombstones` remote product ids the merchant has hidden locally.
 *
 * It never stores a copy of a remote product. Reconciliation (merging the patch
 * onto the immutable remote record) lives in `lib/domain/product`, so persisted
 * state can never pin stale remote sample data as if it were user-owned. Every
 * action is a pure reducer of state; persistence is hydration-safe
 * (`skipHydration`) and failure-tolerant.
 */
export interface OverridesState {
  /** Partial field patches applied to remote products. */
  overrides: ProductOverride[];
  /** Remote product ids hidden from the local catalog. */
  tombstones: number[];
  /**
   * Create or merge a patch for a remote product id. `updatedAt` is supplied by
   * the caller so the reducer stays pure.
   */
  setOverride: (
    id: number,
    patch: ProductOverridePatch,
    updatedAt?: string,
  ) => void;
  /** Remove a product's override patch. */
  removeOverride: (id: number) => void;
  /** Hide a remote product id locally (no-op when already hidden). */
  hideProduct: (id: number) => void;
  /** Un-hide a previously tombstoned remote product id. */
  restoreProduct: (id: number) => void;
  /** Remove every override and tombstone. */
  clear: () => void;
}

type OverridesPersistedState = Pick<OverridesState, "overrides" | "tombstones">;

export const useOverridesStore = create<OverridesState>()(
  persist(
    (set) => ({
      overrides: [],
      tombstones: [],
      setOverride: (id, patch, updatedAt) =>
        set((state) => {
          const index = state.overrides.findIndex((entry) => entry.id === id);
          if (index === -1) {
            const created: ProductOverride = { id, patch: { ...patch } };
            if (updatedAt !== undefined) created.updatedAt = updatedAt;
            return { overrides: [...state.overrides, created] };
          }
          const next = state.overrides.slice();
          const existing = next[index];
          const merged: ProductOverride = {
            id,
            patch: { ...existing.patch, ...patch },
          };
          if (updatedAt !== undefined) {
            merged.updatedAt = updatedAt;
          } else if (existing.updatedAt !== undefined) {
            merged.updatedAt = existing.updatedAt;
          }
          next[index] = merged;
          return { overrides: next };
        }),
      removeOverride: (id) =>
        set((state) => ({
          overrides: state.overrides.filter((entry) => entry.id !== id),
        })),
      hideProduct: (id) =>
        set((state) =>
          state.tombstones.includes(id)
            ? state
            : { tombstones: [...state.tombstones, id] },
        ),
      restoreProduct: (id) =>
        set((state) => ({
          tombstones: state.tombstones.filter((entry) => entry !== id),
        })),
      clear: () => set({ overrides: [], tombstones: [] }),
    }),
    {
      name: STORAGE_KEYS.overrides,
      version: STORAGE_VERSION,
      storage: createSafePersistStorage<OverridesPersistedState>(),
      partialize: (state) => ({
        overrides: state.overrides,
        tombstones: state.tombstones,
      }),
      skipHydration: true,
    },
  ),
);

/* ------------------------------- selectors -------------------------------- */

export const selectOverrides = (state: OverridesState): ProductOverride[] =>
  state.overrides;

export const selectTombstones = (state: OverridesState): number[] =>
  state.tombstones;

export const selectOverridePatch =
  (id: number) =>
  (state: OverridesState): ProductOverridePatch | undefined =>
    state.overrides.find((entry) => entry.id === id)?.patch;

export const selectIsHidden =
  (id: number) =>
  (state: OverridesState): boolean =>
    state.tombstones.includes(id);
