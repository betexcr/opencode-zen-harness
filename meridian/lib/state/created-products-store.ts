import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/api/schemas";
import { isLocalProductId, nextLocalProductId } from "@/lib/domain/product";
import {
  createSafePersistStorage,
  STORAGE_KEYS,
  STORAGE_VERSION,
} from "./persistence";

/**
 * Locally created product state for Meridian Commerce OS.
 *
 * These are products the merchant authored inside the app, not remote DummyJSON
 * sample data. They carry negative ids (allocated with {@link nextLocalProductId})
 * so they can never collide with a positive remote id, and reconciliation gives
 * them precedence over every remote record (see `lib/domain/product`).
 *
 * Because the records are entirely user-owned, persisting the full product is
 * correct here; remote sample data is never written into this store. Every
 * action is a pure reducer of state; persistence is hydration-safe
 * (`skipHydration`) and failure-tolerant.
 */

/** Shape accepted when creating a local product; id and images are normalized. */
export type NewLocalProduct = Omit<Product, "id" | "images" | "reviews" | "dimensions" | "rating"> &
  Partial<Pick<Product, "images" | "reviews" | "dimensions" | "rating">>;

export interface CreatedProductsState {
  /** Locally created products keyed by negative id (insertion-ordered). */
  products: Product[];
  /**
   * Create a product and return its allocated negative id. Pure with respect to
   * state: the id is derived deterministically from the existing product ids.
   */
  create: (input: NewLocalProduct) => number;
  /** Update a locally created product (no-op for unknown ids). */
  update: (id: number, patch: Partial<Product>) => void;
  /** Remove a locally created product. */
  remove: (id: number) => void;
  /** Remove every locally created product. */
  clear: () => void;
}

type CreatedProductsPersistedState = Pick<CreatedProductsState, "products">;

function buildProduct(id: number, input: NewLocalProduct): Product {
  return {
    ...input,
    id,
    rating: input.rating ?? 0,
    dimensions: input.dimensions ?? { width: 0, height: 0, depth: 0 },
    reviews: input.reviews ?? [],
    images: input.images ?? [],
  };
}

export const useCreatedProductsStore = create<CreatedProductsState>()(
  persist(
    (set) => ({
      products: [],
      create: (input) => {
        let allocatedId = 0;
        set((state) => {
          const id = nextLocalProductId(state.products.map((p) => p.id));
          allocatedId = id;
          return { products: [...state.products, buildProduct(id, input)] };
        });
        return allocatedId;
      },
      update: (id, patch) =>
        set((state) => ({
          products: state.products.map((product) =>
            product.id === id ? { ...product, ...patch, id } : product,
          ),
        })),
      remove: (id) =>
        set((state) => ({
          products: state.products.filter((product) => product.id !== id),
        })),
      clear: () => set({ products: [] }),
    }),
    {
      name: STORAGE_KEYS.createdProducts,
      version: STORAGE_VERSION,
      storage: createSafePersistStorage<CreatedProductsPersistedState>(),
      partialize: (state) => ({ products: state.products }),
      skipHydration: true,
    },
  ),
);

/* ------------------------------- selectors -------------------------------- */

export const selectCreatedProducts = (state: CreatedProductsState): Product[] =>
  state.products;

export const selectCreatedProductById =
  (id: number) =>
  (state: CreatedProductsState): Product | undefined =>
    state.products.find((product) => product.id === id);

export const selectCreatedProductCount = (state: CreatedProductsState): number =>
  state.products.length;

/** True when `id` refers to any locally created product. */
export const selectIsCreatedProduct =
  (id: number) =>
  (state: CreatedProductsState): boolean =>
    isLocalProductId(id) && state.products.some((product) => product.id === id);
