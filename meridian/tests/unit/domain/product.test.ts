import { describe, expect, it } from "vitest";

import type { Product } from "@/lib/api/schemas";
import {
  applyProductOverride,
  isLocalProductId,
  isRemoteProductId,
  nextLocalProductId,
  reconcileCatalog,
  reconcileProductById,
  type CatalogSources,
  type ProductOverridePatch,
} from "@/lib/domain/product";

function makeProduct(id: number, overrides: Partial<Product> = {}): Product {
  return {
    id,
    title: `Product ${id}`,
    description: `Description ${id}`,
    category: "beauty",
    price: 19.99,
    discountPercentage: 10.48,
    rating: 4.5,
    stock: 20,
    tags: ["demo"],
    brand: "Meridian",
    sku: `SKU-${id}`,
    weight: 1,
    dimensions: { width: 1, height: 1, depth: 1 },
    warrantyInformation: "1 year warranty",
    shippingInformation: "Ships in 1 day",
    availabilityStatus: "In Stock",
    reviews: [],
    returnPolicy: "30 days return policy",
    minimumOrderQuantity: 1,
    images: [`https://cdn.dummyjson.com/${id}.webp`],
    thumbnail: `https://cdn.dummyjson.com/${id}-thumb.webp`,
    ...overrides,
  };
}

function makeSources(partial: Partial<CatalogSources> = {}): CatalogSources {
  return {
    remote: [],
    overrides: [],
    created: [],
    tombstones: [],
    ...partial,
  };
}

describe("product id helpers", () => {
  it("classifies local ids as negative integers", () => {
    expect(isLocalProductId(-1)).toBe(true);
    expect(isLocalProductId(-42)).toBe(true);
    expect(isLocalProductId(0)).toBe(false);
    expect(isLocalProductId(1)).toBe(false);
    expect(isLocalProductId(-1.5)).toBe(false);
    expect(isLocalProductId(Number.NaN)).toBe(false);
  });

  it("classifies remote ids as positive integers", () => {
    expect(isRemoteProductId(1)).toBe(true);
    expect(isRemoteProductId(194)).toBe(true);
    expect(isRemoteProductId(0)).toBe(false);
    expect(isRemoteProductId(-1)).toBe(false);
    expect(isRemoteProductId(2.5)).toBe(false);
  });
});

describe("product.nextLocalProductId", () => {
  it("returns -1 for an empty id set", () => {
    expect(nextLocalProductId([])).toBe(-1);
  });

  it("allocates one below the smallest existing local id", () => {
    expect(nextLocalProductId([-1])).toBe(-2);
    expect(nextLocalProductId([-1, -2, -3])).toBe(-4);
    expect(nextLocalProductId([-5, -2])).toBe(-6);
  });

  it("ignores remote/positive ids when allocating", () => {
    expect(nextLocalProductId([1, 2, 3])).toBe(-1);
    expect(nextLocalProductId([1, -3, 2])).toBe(-4);
  });
});

describe("product.applyProductOverride", () => {
  it("overlays defined patch fields onto a copy of the remote product", () => {
    const remote = makeProduct(1);
    const patch: ProductOverridePatch = {
      title: "Edited title",
      price: 12.5,
      stock: 3,
    };
    const merged = applyProductOverride(remote, patch);
    expect(merged.title).toBe("Edited title");
    expect(merged.price).toBe(12.5);
    expect(merged.stock).toBe(3);
    // untouched fields preserved
    expect(merged.category).toBe(remote.category);
    expect(merged.sku).toBe(remote.sku);
    expect(merged.id).toBe(1);
  });

  it("preserves the remote record (never mutates the input)", () => {
    const remote = makeProduct(1);
    const snapshot = { ...remote };
    applyProductOverride(remote, { title: "Changed" });
    expect(remote).toEqual(snapshot);
    expect(remote.title).toBe("Product 1");
  });

  it("keeps a deliberate zero price rather than falling back (?? not ||)", () => {
    const merged = applyProductOverride(makeProduct(1), { price: 0 });
    expect(merged.price).toBe(0);
  });

  it("falls back to the remote value for undefined patch fields", () => {
    const remote = makeProduct(7, { brand: "Base" });
    const merged = applyProductOverride(remote, { title: undefined, brand: undefined });
    expect(merged.title).toBe("Product 7");
    expect(merged.brand).toBe("Base");
  });

  it("does not patch non-editable identity/derived fields", () => {
    const remote = makeProduct(9);
    const merged = applyProductOverride(remote, {
      title: "T",
    });
    // sku, rating, dimensions etc. must come straight from remote
    expect(merged.sku).toBe(remote.sku);
    expect(merged.rating).toBe(remote.rating);
    expect(merged.dimensions).toBe(remote.dimensions);
    expect(merged.thumbnail).toBe(remote.thumbnail);
  });
});

describe("product.reconcileCatalog", () => {
  it("returns remote products annotated as origin remote", () => {
    const result = reconcileCatalog(makeSources({ remote: [makeProduct(1), makeProduct(2)] }));
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 1, origin: "remote", overridden: false });
    expect(result[1]).toMatchObject({ id: 2, origin: "remote", overridden: false });
  });

  it("applies overrides and marks the record overridden", () => {
    const result = reconcileCatalog(
      makeSources({
        remote: [makeProduct(1)],
        overrides: [{ id: 1, patch: { title: "Overridden" }, updatedAt: "2026-01-01" }],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Overridden");
    expect(result[0].overridden).toBe(true);
    expect(result[0].origin).toBe("remote");
  });

  it("ignores overrides for ids that are not present remotely", () => {
    const result = reconcileCatalog(
      makeSources({
        remote: [makeProduct(1)],
        overrides: [{ id: 999, patch: { title: "Ghost" } }],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("hides tombstoned remote ids but keeps non-tombstoned ones", () => {
    const result = reconcileCatalog(
      makeSources({
        remote: [makeProduct(1), makeProduct(2), makeProduct(3)],
        tombstones: [2],
      }),
    );
    expect(result.map((p) => p.id)).toEqual([1, 3]);
  });

  it("appends locally created products with origin local", () => {
    const local = makeProduct(-1, { title: "Local one" });
    const result = reconcileCatalog(
      makeSources({ remote: [makeProduct(1)], created: [local] }),
    );
    expect(result.map((p) => p.id)).toEqual([1, -1]);
    const created = result.find((p) => p.id === -1);
    expect(created).toMatchObject({ title: "Local one", origin: "local", overridden: false });
  });

  it("orders remote first then created, preserving source order", () => {
    const result = reconcileCatalog(
      makeSources({
        remote: [makeProduct(1), makeProduct(2)],
        created: [makeProduct(-1), makeProduct(-2)],
      }),
    );
    expect(result.map((p) => p.id)).toEqual([1, 2, -1, -2]);
  });

  it("lets a created product win over a remote record sharing its id", () => {
    const result = reconcileCatalog(
      makeSources({
        remote: [makeProduct(1, { title: "Remote" })],
        created: [makeProduct(1, { title: "Local wins" })],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Local wins");
    expect(result[0].origin).toBe("local");
  });

  it("never hides a locally created product via a tombstone", () => {
    const result = reconcileCatalog(
      makeSources({
        remote: [],
        created: [makeProduct(-1, { title: "Local" })],
        tombstones: [-1],
      }),
    );
    expect(result.map((p) => p.id)).toEqual([-1]);
  });

  it("applies only the last override when duplicates target one id", () => {
    const result = reconcileCatalog(
      makeSources({
        remote: [makeProduct(1)],
        overrides: [
          { id: 1, patch: { title: "First" } },
          { id: 1, patch: { title: "Second" } },
        ],
      }),
    );
    expect(result[0].title).toBe("Second");
    expect(result[0].overridden).toBe(true);
  });

  it("returns an empty catalog when every source is empty", () => {
    expect(reconcileCatalog(makeSources())).toEqual([]);
  });
});

describe("product.reconcileProductById", () => {
  const sources = makeSources({
    remote: [makeProduct(1), makeProduct(2)],
    overrides: [{ id: 1, patch: { price: 5 } }],
    created: [makeProduct(-1, { title: "Local" })],
    tombstones: [2],
  });

  it("returns a locally created product first, ignoring tombstones", () => {
    const result = reconcileProductById(-1, sources);
    expect(result).toMatchObject({ id: -1, title: "Local", origin: "local", overridden: false });
  });

  it("applies overrides for a remote product", () => {
    const result = reconcileProductById(1, sources);
    expect(result).toMatchObject({ id: 1, price: 5, origin: "remote", overridden: true });
  });

  it("returns undefined for a tombstoned remote id", () => {
    expect(reconcileProductById(2, sources)).toBeUndefined();
  });

  it("returns undefined for an unknown id", () => {
    expect(reconcileProductById(999, sources)).toBeUndefined();
    expect(reconcileProductById(-999, sources)).toBeUndefined();
  });

  it("reports overridden false when no override exists for the remote id", () => {
    const result = reconcileProductById(2, makeSources({ remote: [makeProduct(2)] }));
    expect(result).toMatchObject({ id: 2, origin: "remote", overridden: false });
  });

  it("agrees with reconcileCatalog for a single lookup", () => {
    const catalog = reconcileCatalog(sources);
    const byId = reconcileProductById(1, sources);
    expect(byId).toEqual(catalog.find((p) => p.id === 1));
  });
});
