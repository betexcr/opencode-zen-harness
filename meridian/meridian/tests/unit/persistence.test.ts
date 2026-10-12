import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CartLine } from "@/lib/domain/cart";
import { useCartStore } from "@/lib/state/cart-store";
import {
  STORAGE_KEYS,
  createSafePersistStorage,
} from "@/lib/state/persistence";

const persisted: CartLine = {
  productId: 7,
  title: "Persisted product",
  thumbnail: "https://cdn.dummyjson.com/product-images/7.webp",
  price: 42,
  discountPercentage: 0,
  quantity: 2,
};

describe("safe persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCartStore.setState({ lines: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    useCartStore.setState({ lines: [] });
  });

  it("round-trips a value through localStorage", () => {
    const storage = createSafePersistStorage<{ count: number }>();
    storage.setItem("meridian.test", { state: { count: 3 }, version: 1 });
    expect(storage.getItem("meridian.test")).toEqual({
      state: { count: 3 },
      version: 1,
    });
  });

  it("returns null for malformed payloads instead of throwing", () => {
    const storage = createSafePersistStorage<{ count: number }>();

    window.localStorage.setItem("meridian.test", "{ not json");
    expect(storage.getItem("meridian.test")).toBeNull();

    window.localStorage.setItem(
      "meridian.test",
      JSON.stringify({ notState: true }),
    );
    expect(storage.getItem("meridian.test")).toBeNull();
  });

  it("tolerates a storage backend that throws on read and write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    const storage = createSafePersistStorage<{ count: number }>();

    expect(() =>
      storage.setItem("meridian.test", { state: { count: 1 }, version: 1 }),
    ).not.toThrow();
    expect(storage.getItem("meridian.test")).toBeNull();
    expect(() => storage.removeItem("meridian.test")).not.toThrow();
  });

  it("persists and rehydrates the cart store across a refresh", async () => {
    useCartStore.getState().addLine(persisted, 2);

    const snapshot = window.localStorage.getItem(STORAGE_KEYS.cart);
    expect(snapshot).toContain("Persisted product");

    // Simulate a page refresh: drop in-memory state, restore the stored
    // snapshot (resetting state re-persists an empty cart), then rehydrate.
    useCartStore.setState({ lines: [] });
    window.localStorage.setItem(STORAGE_KEYS.cart, snapshot ?? "");
    await useCartStore.persist.rehydrate();

    const lines = useCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ productId: 7, quantity: 2 });
  });

  it("degrades to in-memory state when storage writes fail", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => useCartStore.getState().addLine(persisted, 1)).not.toThrow();
    expect(useCartStore.getState().lines).toHaveLength(1);
  });
});
