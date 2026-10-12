import { describe, expect, it } from "vitest";

import type { Product } from "@/lib/api/schemas";
import {
  applyProductOverride,
  reconcileCatalog,
  type ProductOverride,
} from "@/lib/domain/product";

function product(id: number, overrides: Partial<Product> = {}): Product {
  return {
    id,
    title: `Product ${id}`,
    description: `Description ${id}`,
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
  it("returns the remote product unchanged when there is no override", () => {
    const remote = product(1);
    const [reconciled] = reconcileCatalog({
      remote: [remote],
      overrides: [],
      created: [],
      tombstones: [],
    });

    expect(reconciled).toBeDefined();
    expect(reconciled.overridden).toBe(false);
    expect(reconciled.origin).toBe("remote");
    expect(reconciled.price).toBe(remote.price);
    expect(reconciled.title).toBe(remote.title);
  });

  it("applies only the overridden fields and never mutates the remote product", () => {
    const remote = product(1, { price: 100, stock: 10, title: "Base" });
    const override: ProductOverride = {
      id: 1,
      patch: { price: 80, title: "Edited title" },
    };

    const [reconciled] = reconcileCatalog({
      remote: [remote],
      overrides: [override],
      created: [],
      tombstones: [],
    });

    expect(reconciled).not.toBe(remote);
    expect(reconciled.price).toBe(80);
    expect(reconciled.title).toBe("Edited title");
    expect(reconciled.stock).toBe(10);
    expect(reconciled.overridden).toBe(true);
    expect(remote.price).toBe(100);
    expect(remote.title).toBe("Base");
  });

  it("hides tombstoned remote products from the merged catalog", () => {
    const remote = product(1);
    const result = reconcileCatalog({
      remote: [remote],
      overrides: [],
      created: [],
      tombstones: [1],
    });

    expect(result).toHaveLength(0);
  });

  it("reconciles a remote page, hiding tombstoned products", () => {
    const remote = [product(1), product(2)];
    const result = reconcileCatalog({
      remote,
      overrides: [{ id: 1, patch: { price: 55 } }],
      created: [],
      tombstones: [2],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 1, price: 55, overridden: true });
  });

  it("appends locally created products after the reconciled remote set", () => {
    const created = product(500, { title: "Local exclusive" });
    const result = reconcileCatalog({
      remote: [product(1)],
      overrides: [],
      created: [created],
      tombstones: [],
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(1);
    expect(result[1]?.id).toBe(500);
    expect(result[1]?.origin).toBe("local");
  });
});