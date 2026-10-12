import { describe, expect, it } from "vitest";

import type { Product } from "@/lib/api/schemas";
import {
  applyProductOverride,
  reconcileCatalog,
  reconcileProductById,
  type CatalogSources,
} from "@/lib/domain/product";

function product(id: number, overrides: Partial<Product> = {}): Product {
  return {
    id,
    title: `Product ${id}`,
    description: `Product ${id} description`,
    category: "test",
    price: 100,
    discountPercentage: 0,
    rating: 4.5,
    stock: 10,
    tags: ["test"],
    brand: "Meridian",
    sku: `SKU-${id}`,
    weight: 1,
    dimensions: { width: 1, height: 1, depth: 1 },
    warrantyInformation: "1 year warranty",
    shippingInformation: "Ships in 1 day",
    availabilityStatus: "In Stock",
    reviews: [],
    returnPolicy: "30 day returns",
    minimumOrderQuantity: 1,
    images: [`https://cdn.dummyjson.com/product-images/${id}.webp`],
    thumbnail: `https://cdn.dummyjson.com/product-images/${id}.webp`,
    ...overrides,
  };
}

describe("product override reconciliation", () => {
  it("returns the remote product unchanged when there is no patch", () => {
    const remote = product(1);
    expect(applyProductOverride(remote, {})).toEqual(remote);
  });

  it("applies only the overridden fields and never mutates the remote product", () => {
    const remote = product(1, { price: 100, stock: 10, title: "Base" });
    const merged = applyProductOverride(remote, {
      price: 80,
      title: "Edited title",
    });

    expect(merged).not.toBe(remote);
    expect(merged.price).toBe(80);
    expect(merged.title).toBe("Edited title");
    expect(merged.stock).toBe(10);
    expect(remote.price).toBe(100);
    expect(remote.title).toBe("Base");
  });

  it("preserves a deliberate zero price and zero stock", () => {
    const remote = product(1, { price: 100, stock: 10 });
    const merged = applyProductOverride(remote, { price: 0, stock: 0 });
    expect(merged.price).toBe(0);
    expect(merged.stock).toBe(0);
  });

  it("hides tombstoned remote products and applies overrides to the rest", () => {
    const sources: CatalogSources = {
      remote: [product(1), product(2)],
      overrides: [{ id: 1, patch: { price: 55 } }],
      created: [],
      tombstones: [2],
    };

    const result = reconcileCatalog(sources);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      price: 55,
      origin: "remote",
      overridden: true,
    });
  });

  it("appends locally created products after the reconciled remote set", () => {
    const sources: CatalogSources = {
      remote: [product(1)],
      overrides: [],
      created: [product(500, { title: "Local exclusive" })],
      tombstones: [],
    };

    const result = reconcileCatalog(sources);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 1, origin: "remote" });
    expect(result[1]).toMatchObject({
      id: 500,
      title: "Local exclusive",
      origin: "local",
    });
  });

  it("reconciles a single product by id, or returns undefined when hidden", () => {
    const sources: CatalogSources = {
      remote: [product(1), product(2)],
      overrides: [],
      created: [],
      tombstones: [2],
    };

    expect(reconcileProductById(1, sources)).toMatchObject({
      id: 1,
      origin: "remote",
    });
    expect(reconcileProductById(2, sources)).toBeUndefined();
    expect(reconcileProductById(999, sources)).toBeUndefined();
  });
});
