import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createSafePersistStorage,
  STORAGE_KEYS,
  STORAGE_VERSION,
} from "./persistence";

/**
 * Merchandising configuration state for Meridian Commerce OS.
 *
 * The merchant studio lets a store owner curate the storefront without touching
 * the backend: which products are featured, the order of a curated collection,
 * and a small set of presentation choices. This is LOCAL application state that
 * survives refresh.
 *
 * The config references products by id only — never by embedding a remote
 * record — so remote API sample data is never persisted as if it were
 * user-owned; the catalog layer resolves ids against live data at render time.
 * Every action is a pure reducer of state; persistence is hydration-safe
 * (`skipHydration`) and failure-tolerant.
 */

/** Sortable fields for a curated collection. */
export type MerchandisingSort = "curated" | "price-asc" | "price-desc" | "rating";

export interface MerchandisingConfig {
  /** Product ids pinned to the storefront "featured" rail, in display order. */
  featuredProductIds: number[];
  /** Product ids in a hand-curated collection, in display order. */
  curatedProductIds: number[];
  /** How the curated collection is presented. */
  sort: MerchandisingSort;
  /** Editorial headline shown above the featured rail. */
  featuredHeadline: string;
}

/** Bounds a merchandising config to a valid, displayable state. */
export const DEFAULT_MERCHANDISING_CONFIG: MerchandisingConfig = {
  featuredProductIds: [],
  curatedProductIds: [],
  sort: "curated",
  featuredHeadline: "Featured this week",
};

/** Whitelist check so persisted/edited values can never drift out of range. */
export function normalizeSort(value: unknown): MerchandisingSort {
  return value === "price-asc" || value === "price-desc" || value === "rating"
    ? value
    : "curated";
}

/** Insert a product id if absent, preserving order; no-op when present. */
function addUnique(ids: readonly number[], id: number): number[] {
  return ids.includes(id) ? [...ids] : [...ids, id];
}

/** Remove a product id, preserving the order of the rest. */
function removeId(ids: readonly number[], id: number): number[] {
  return ids.filter((entry) => entry !== id);
}

/** Move `id` from `from` to `to`, clamped to the list bounds. Pure. */
function moveId(ids: readonly number[], id: number, to: number): number[] {
  const from = ids.indexOf(id);
  if (from === -1) return [...ids];
  const next = ids.slice();
  next.splice(from, 1);
  const target = Math.max(0, Math.min(to, next.length));
  next.splice(target, 0, id);
  return next;
}

export interface MerchandisingState {
  /** Current merchandising configuration. */
  config: MerchandisingConfig;
  /** Pin a product to the featured rail (idempotent). */
  featureProduct: (productId: number) => void;
  /** Remove a product from the featured rail. */
  unfeatureProduct: (productId: number) => void;
  /** Add a product to the curated collection (idempotent). */
  curateProduct: (productId: number) => void;
  /** Remove a product from the curated collection. */
  uncurateProduct: (productId: number) => void;
  /** Reorder a curated product to a new index (clamped). */
  reorderCuratedProduct: (productId: number, to: number) => void;
  /** Reorder a featured product to a new index (clamped). */
  reorderFeaturedProduct: (productId: number, to: number) => void;
  /** Set the curated collection sort mode. */
  setSort: (sort: MerchandisingSort) => void;
  /** Set the featured rail headline. */
  setFeaturedHeadline: (headline: string) => void;
  /** Reset every merchandising choice to defaults. */
  reset: () => void;
}

type MerchandisingPersistedState = Pick<MerchandisingState, "config">;

export const useMerchandisingStore = create<MerchandisingState>()(
  persist(
    (set) => ({
      config: { ...DEFAULT_MERCHANDISING_CONFIG },
      featureProduct: (productId) =>
        set((state) => ({
          config: {
            ...state.config,
            featuredProductIds: addUnique(state.config.featuredProductIds, productId),
          },
        })),
      unfeatureProduct: (productId) =>
        set((state) => ({
          config: {
            ...state.config,
            featuredProductIds: removeId(state.config.featuredProductIds, productId),
          },
        })),
      curateProduct: (productId) =>
        set((state) => ({
          config: {
            ...state.config,
            curatedProductIds: addUnique(state.config.curatedProductIds, productId),
          },
        })),
      uncurateProduct: (productId) =>
        set((state) => ({
          config: {
            ...state.config,
            curatedProductIds: removeId(state.config.curatedProductIds, productId),
          },
        })),
      reorderCuratedProduct: (productId, to) =>
        set((state) => ({
          config: {
            ...state.config,
            curatedProductIds: moveId(state.config.curatedProductIds, productId, to),
          },
        })),
      reorderFeaturedProduct: (productId, to) =>
        set((state) => ({
          config: {
            ...state.config,
            featuredProductIds: moveId(state.config.featuredProductIds, productId, to),
          },
        })),
      setSort: (sort) =>
        set((state) => ({ config: { ...state.config, sort: normalizeSort(sort) } })),
      setFeaturedHeadline: (headline) =>
        set((state) => ({ config: { ...state.config, featuredHeadline: headline } })),
      reset: () => set({ config: { ...DEFAULT_MERCHANDISING_CONFIG } }),
    }),
    {
      name: STORAGE_KEYS.merchandising,
      version: STORAGE_VERSION,
      storage: createSafePersistStorage<MerchandisingPersistedState>(),
      partialize: (state) => ({ config: state.config }),
      merge: (persisted, current) => ({
        ...current,
        config: { ...current.config, ...(persisted as Partial<MerchandisingPersistedState>).config },
      }),
      skipHydration: true,
    },
  ),
);

/* ------------------------------- selectors -------------------------------- */

export const selectMerchandisingConfig = (
  state: MerchandisingState,
): MerchandisingConfig => state.config;

export const selectFeaturedProductIds = (state: MerchandisingState): number[] =>
  state.config.featuredProductIds;

export const selectCuratedProductIds = (state: MerchandisingState): number[] =>
  state.config.curatedProductIds;

export const selectIsFeatured =
  (productId: number) =>
  (state: MerchandisingState): boolean =>
    state.config.featuredProductIds.includes(productId);

export const selectIsCurated =
  (productId: number) =>
  (state: MerchandisingState): boolean =>
    state.config.curatedProductIds.includes(productId);
