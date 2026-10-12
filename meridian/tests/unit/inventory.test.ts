import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  inventoryStatus,
} from "@/lib/domain/inventory";

describe("inventory thresholds", () => {
  it("classifies stock at or below zero as out", () => {
    expect(inventoryStatus({ stock: 0 })).toBe("out-of-stock");
    expect(inventoryStatus({ stock: -3 })).toBe("out-of-stock");
  });

  it("classifies stock at or below the default threshold as low", () => {
    expect(inventoryStatus({ stock: 1 })).toBe("low-stock");
    expect(inventoryStatus({ stock: DEFAULT_LOW_STOCK_THRESHOLD })).toBe(
      "low-stock",
    );
  });

  it("classifies stock above the default threshold as in-stock", () => {
    expect(inventoryStatus({ stock: DEFAULT_LOW_STOCK_THRESHOLD + 1 })).toBe(
      "in-stock",
    );
    expect(inventoryStatus({ stock: 100 })).toBe("in-stock");
  });

  it("raises the effective threshold to the minimum order quantity", () => {
    expect(
      inventoryStatus({ stock: 8, minimumOrderQuantity: 10 }),
    ).toBe("low-stock");
    expect(
      inventoryStatus({ stock: 11, minimumOrderQuantity: 10 }),
    ).toBe("in-stock");
  });
});
