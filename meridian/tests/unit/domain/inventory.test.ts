import { describe, expect, it } from "vitest";

import type { Product } from "@/lib/api/schemas";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  canOrderQuantity,
  inventoryStatus,
  inventoryStatusLabel,
  isInStock,
  isLowStock,
  isOutOfStock,
  lowStockThresholdFor,
  maxOrderableQuantity,
  normalizeStock,
  productInventoryStatus,
} from "@/lib/domain/inventory";

const baseProduct: Pick<Product, "stock" | "minimumOrderQuantity"> = {
  stock: 10,
  minimumOrderQuantity: 1,
};

describe("inventory.lowStockThresholdFor", () => {
  it("returns the default threshold when MOQ is absent or below default", () => {
    expect(lowStockThresholdFor({ stock: 10 })).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    expect(lowStockThresholdFor({ stock: 10, minimumOrderQuantity: undefined })).toBe(
      DEFAULT_LOW_STOCK_THRESHOLD,
    );
    expect(lowStockThresholdFor({ stock: 10, minimumOrderQuantity: 3 })).toBe(
      DEFAULT_LOW_STOCK_THRESHOLD,
    );
    expect(lowStockThresholdFor({ stock: 10, minimumOrderQuantity: 0 })).toBe(
      DEFAULT_LOW_STOCK_THRESHOLD,
    );
  });

  it("uses MOQ as the threshold when MOQ exceeds the default", () => {
    expect(lowStockThresholdFor({ stock: 20, minimumOrderQuantity: 10 })).toBe(10);
    expect(lowStockThresholdFor({ stock: 5, minimumOrderQuantity: 100 })).toBe(100);
  });

  it("treats non-finite MOQ as zero", () => {
    expect(
      lowStockThresholdFor({
        stock: 5,
        minimumOrderQuantity: Number.NaN,
      }),
    ).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
  });
});

describe("inventory.normalizeStock", () => {
  it("returns zero for non-positive or non-finite values", () => {
    expect(normalizeStock(0)).toBe(0);
    expect(normalizeStock(-5)).toBe(0);
    expect(normalizeStock(Number.NaN)).toBe(0);
    expect(normalizeStock(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeStock(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("floors fractional stock to a whole number and clamps to zero floor", () => {
    expect(normalizeStock(7.9)).toBe(7);
    expect(normalizeStock(2.1)).toBe(2);
  });
});

describe("inventory.inventoryStatus", () => {
  it("returns out-of-stock when stock <= 0", () => {
    expect(inventoryStatus({ stock: 0 })).toBe("out-of-stock");
    expect(inventoryStatus({ stock: -1 })).toBe("out-of-stock");
    expect(inventoryStatus({ stock: Number.NaN })).toBe("out-of-stock");
  });

  it("returns low-stock when stock is > 0 and <= effective threshold", () => {
    expect(inventoryStatus({ stock: 1 })).toBe("low-stock");
    expect(inventoryStatus({ stock: DEFAULT_LOW_STOCK_THRESHOLD })).toBe("low-stock");
    expect(
      inventoryStatus({ stock: 5, minimumOrderQuantity: 10 }),
    ).toBe("low-stock");
    expect(
      inventoryStatus({ stock: 10, minimumOrderQuantity: 10 }),
    ).toBe("low-stock");
  });

  it("returns in-stock when stock > effective threshold", () => {
    expect(inventoryStatus({ stock: 6 })).toBe("in-stock");
    expect(inventoryStatus({ stock: 11, minimumOrderQuantity: 10 })).toBe("in-stock");
    expect(inventoryStatus({ stock: 100 })).toBe("in-stock");
  });

  it("honors MOQ when determining the threshold (prevents optimistic status)", () => {
    expect(inventoryStatus({ stock: 8, minimumOrderQuantity: 20 })).toBe("low-stock");
    expect(inventoryStatus({ stock: 21, minimumOrderQuantity: 20 })).toBe("in-stock");
  });
});

describe("inventory status predicates", () => {
  it("isOutOfStock matches status", () => {
    expect(isOutOfStock({ stock: 0 })).toBe(true);
    expect(isOutOfStock({ stock: 3 })).toBe(false);
  });

  it("isLowStock matches status", () => {
    expect(isLowStock({ stock: 3 })).toBe(true);
    expect(isLowStock({ stock: 0 })).toBe(false);
    expect(isLowStock({ stock: 10 })).toBe(false);
  });

  it("isInStock matches status", () => {
    expect(isInStock({ stock: 10 })).toBe(true);
    expect(isInStock({ stock: 3 })).toBe(false);
    expect(isInStock({ stock: 0 })).toBe(false);
  });
});

describe("inventory.canOrderQuantity", () => {
  it("rejects non-positive or non-finite quantities", () => {
    expect(canOrderQuantity(baseProduct, 0)).toBe(false);
    expect(canOrderQuantity(baseProduct, -1)).toBe(false);
    expect(canOrderQuantity(baseProduct, Number.NaN)).toBe(false);
    expect(canOrderQuantity(baseProduct, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("requires the quantity to be a multiple of MOQ (MOQ defaults to 1)", () => {
    expect(canOrderQuantity(baseProduct, 2)).toBe(true);
    expect(canOrderQuantity(baseProduct, 10)).toBe(true);
    expect(canOrderQuantity(baseProduct, 3)).toBe(true);
    expect(canOrderQuantity({ stock: 10, minimumOrderQuantity: 3 }, 3)).toBe(true);
    expect(canOrderQuantity({ stock: 10, minimumOrderQuantity: 3 }, 6)).toBe(true);
    expect(canOrderQuantity({ stock: 10, minimumOrderQuantity: 3 }, 9)).toBe(true);
    expect(canOrderQuantity({ stock: 10, minimumOrderQuantity: 3 }, 1)).toBe(false);
    expect(canOrderQuantity({ stock: 10, minimumOrderQuantity: 3 }, 4)).toBe(false);
  });

  it("rejects quantities exceeding available stock", () => {
    expect(canOrderQuantity({ stock: 5, minimumOrderQuantity: 1 }, 6)).toBe(false);
    expect(canOrderQuantity({ stock: 5, minimumOrderQuantity: 3 }, 6)).toBe(false);
  });

  it("treats MOQ <= 0 as 1 for the multiple check", () => {
    expect(canOrderQuantity({ stock: 5, minimumOrderQuantity: 0 }, 2)).toBe(true);
    expect(canOrderQuantity({ stock: 5, minimumOrderQuantity: -3 }, 1)).toBe(true);
    expect(canOrderQuantity({ stock: 5, minimumOrderQuantity: -3 }, 2)).toBe(true);
  });
});

describe("inventory.maxOrderableQuantity", () => {
  it("returns the maximum whole-MOQ quantity within stock", () => {
    expect(maxOrderableQuantity({ stock: 10, minimumOrderQuantity: 1 })).toBe(10);
    expect(maxOrderableQuantity({ stock: 10, minimumOrderQuantity: 3 })).toBe(9);
    expect(maxOrderableQuantity({ stock: 11, minimumOrderQuantity: 3 })).toBe(9);
    expect(maxOrderableQuantity({ stock: 2, minimumOrderQuantity: 3 })).toBe(0);
  });

  it("treats MOQ <= 0 as 1", () => {
    expect(maxOrderableQuantity({ stock: 5, minimumOrderQuantity: 0 })).toBe(5);
    expect(maxOrderableQuantity({ stock: 5, minimumOrderQuantity: -10 })).toBe(5);
  });

  it("returns 0 when stock is 0", () => {
    expect(maxOrderableQuantity({ stock: 0, minimumOrderQuantity: 5 })).toBe(0);
  });
});

describe("inventory.inventoryStatusLabel", () => {
  it("maps statuses to human-readable labels", () => {
    expect(inventoryStatusLabel("out-of-stock")).toBe("Out of stock");
    expect(inventoryStatusLabel("low-stock")).toBe("Low stock");
    expect(inventoryStatusLabel("in-stock")).toBe("In stock");
  });
});

describe("inventory.productInventoryStatus", () => {
  it("classifies a product record using stock and minimumOrderQuantity", () => {
    const product: Pick<Product, "stock" | "minimumOrderQuantity"> = {
      stock: 3,
      minimumOrderQuantity: 1,
    };
    expect(productInventoryStatus(product)).toBe("low-stock");
    expect(productInventoryStatus({ ...product, stock: 20 })).toBe("in-stock");
    expect(productInventoryStatus({ ...product, stock: 0 })).toBe("out-of-stock");
  });
});
