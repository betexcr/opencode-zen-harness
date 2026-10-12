import type { Product } from "../api/schemas";

/**
 * Remote-vs-local product reconciliation for Meridian Commerce OS.
 *
 * Meridian renders two very different sources of product data through one
 * catalog:
 *
 *   1. REMOTE sample data from DummyJSON. This is authoritative, READ-ONLY
 *      reference data. The domain never mutates a remote record; it copies it.
 *   2. LOCAL application state: merchant overrides of remote records, products
 *      created entirely in the app, and "tombstones" that hide a remote record
 *      locally.
 *
 * PRECEDENCE (highest wins), applied deterministically:
 *
 *   1. Local created products — always present, always win. They carry negative
 *      ids (see {@link nextLocalProductId}) so they can never collide with a
 *      positive DummyJSON id.
 *   2. Tombstones — a remote id listed here is hidden from the merged catalog.
 *      Tombstones only affect remote records; a locally created product is
 *      never hidden.
 *   3. Local overrides — a partial patch applied on top of a remote record.
 *      Only the fields a merchant can edit are patchable; identity and derived
 *      remote metadata are preserved from the sample record.
 *   4. Remote sample data — the immutable base.
 *
 * Remote records are copied, never mutated, so callers may safely retain a
 * cached remote object. Every function in this module is pure and I/O free.
 */

/** The only product fields a local override may patch. */
export interface ProductOverridePatch {
  title?: string;
  description?: string;
  category?: string;
  price?: number;
  discountPercentage?: number;
  stock?: number;
  brand?: string;
  tags?: string[];
  minimumOrderQuantity?: number;
}

/** A local field patch targeting an existing remote product id. */
export interface ProductOverride {
  /** Remote (positive) product id the patch applies to. */
  id: number;
  /** Fields to overlay onto the remote record. */
  patch: ProductOverridePatch;
  /** Informational ISO timestamp; not used by reconciliation. */
  updatedAt?: string;
}

/** Where a reconciled product's base record originated. */
export type ProductOrigin = "remote" | "local";

/** A product after reconciliation, annotated with its provenance. */
export interface ReconciledProduct extends Product {
  origin: ProductOrigin;
  /** True when a local override patched this remote record. */
  overridden: boolean;
}

/** The four local/remote sources merged into a catalog. */
export interface CatalogSources {
  /** Immutable remote sample products (positive ids). */
  remote: readonly Product[];
  /** Local patches applied to remote products. */
  overrides: readonly ProductOverride[];
  /** Products created locally (negative ids). */
  created: readonly Product[];
  /** Remote product ids hidden locally. */
  tombstones: readonly number[];
}

/** True for a locally generated product id (negative integer). */
export function isLocalProductId(id: number): boolean {
  return Number.isInteger(id) && id < 0;
}

/** True for a remote DummyJSON product id (positive integer). */
export function isRemoteProductId(id: number): boolean {
  return Number.isInteger(id) && id > 0;
}

/**
 * Allocate the next locally generated product id: one below the smallest
 * existing local id. Pure and deterministic for a given id set.
 */
export function nextLocalProductId(existingIds: readonly number[]): number {
  let smallest = 0;
  for (const id of existingIds) {
    if (isLocalProductId(id) && id < smallest) smallest = id;
  }
  return smallest - 1;
}

/**
 * Overlay a patch onto a remote product, copying the remote record so it is
 * never mutated. Only defined patch fields are applied; `undefined` falls back
 * to the remote value, so a deliberate `0` price is preserved (`??`, not `||`).
 */
export function applyProductOverride(
  product: Product,
  patch: ProductOverridePatch,
): Product {
  return {
    ...product,
    title: patch.title ?? product.title,
    description: patch.description ?? product.description,
    category: patch.category ?? product.category,
    price: patch.price ?? product.price,
    discountPercentage: patch.discountPercentage ?? product.discountPercentage,
    stock: patch.stock ?? product.stock,
    brand: patch.brand ?? product.brand,
    tags: patch.tags ?? product.tags,
    minimumOrderQuantity:
      patch.minimumOrderQuantity ?? product.minimumOrderQuantity,
  };
}

/**
 * Merge every source into a single, deterministically ordered catalog.
 *
 * Ordering: remote products first (in source order, tombstones removed), then
 * locally created products (in source order). Duplicate ids keep their first
 * position; a later source for the same id wins the value, so a created local
 * product beats a remote record that happens to share its id.
 */
export function reconcileCatalog(sources: CatalogSources): ReconciledProduct[] {
  const overrideById = new Map<number, ProductOverridePatch>();
  for (const override of sources.overrides) {
    overrideById.set(override.id, override.patch);
  }
  const tombstoned = new Set(sources.tombstones);

  const byId = new Map<number, ReconciledProduct>();

  for (const product of sources.remote) {
    if (tombstoned.has(product.id)) continue;
    const patch = overrideById.get(product.id);
    const merged = patch ? applyProductOverride(product, patch) : product;
    byId.set(product.id, {
      ...merged,
      origin: "remote",
      overridden: patch !== undefined,
    });
  }

  for (const product of sources.created) {
    byId.set(product.id, { ...product, origin: "local", overridden: false });
  }

  return [...byId.values()];
}

/**
 * Reconcile a single product by id following the same precedence as
 * {@link reconcileCatalog}; returns `undefined` when the id is unknown or a
 * remote record hidden by a tombstone.
 */
export function reconcileProductById(
  id: number,
  sources: CatalogSources,
): ReconciledProduct | undefined {
  const created = sources.created.find((product) => product.id === id);
  if (created) {
    return { ...created, origin: "local", overridden: false };
  }

  if (sources.tombstones.includes(id)) return undefined;

  const remote = sources.remote.find((product) => product.id === id);
  if (!remote) return undefined;

  const override = sources.overrides.find((entry) => entry.id === id);
  const merged = override ? applyProductOverride(remote, override.patch) : remote;
  return {
    ...merged,
    origin: "remote",
    overridden: override !== undefined,
  };
}
