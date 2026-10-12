import { afterEach, describe, expect, it, vi } from "vitest";
import type { StorageValue } from "zustand/middleware";

import {
  createSafePersistStorage,
  STORAGE_KEYS,
  STORAGE_VERSION,
} from "@/lib/state/persistence";

interface DemoState {
  count: number;
  label: string;
}

const demoValue: StorageValue<DemoState> = {
  state: { count: 3, label: "ok" },
  version: STORAGE_VERSION,
};

describe("persistence constants", () => {
  it("namespaces every store key under `meridian.`", () => {
    const keys = Object.values(STORAGE_KEYS);
    expect(keys).toHaveLength(7);
    for (const key of keys) {
      expect(key.startsWith("meridian.")).toBe(true);
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("exposes a single shared schema version", () => {
    expect(STORAGE_VERSION).toBe(1);
  });
});

describe("createSafePersistStorage round-trip", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("writes a value and reads the exact same value back", () => {
    const storage = createSafePersistStorage<DemoState>();
    storage.setItem(STORAGE_KEYS.cart, demoValue);

    expect(window.localStorage.getItem(STORAGE_KEYS.cart)).not.toBeNull();
    expect(storage.getItem(STORAGE_KEYS.cart)).toEqual(demoValue);
  });

  it("returns null for a key that was never written", () => {
    const storage = createSafePersistStorage<DemoState>();
    expect(storage.getItem("meridian.absent")).toBeNull();
  });

  it("returns null for malformed JSON instead of throwing", () => {
    window.localStorage.setItem(STORAGE_KEYS.cart, "{not valid json");
    const storage = createSafePersistStorage<DemoState>();
    expect(storage.getItem(STORAGE_KEYS.cart)).toBeNull();
  });

  it("returns null for a payload without a `state` member", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.cart,
      JSON.stringify({ version: STORAGE_VERSION }),
    );
    const storage = createSafePersistStorage<DemoState>();
    expect(storage.getItem(STORAGE_KEYS.cart)).toBeNull();
  });

  it("removes a persisted value", () => {
    const storage = createSafePersistStorage<DemoState>();
    storage.setItem(STORAGE_KEYS.cart, demoValue);
    storage.removeItem(STORAGE_KEYS.cart);
    expect(storage.getItem(STORAGE_KEYS.cart)).toBeNull();
  });
});

describe("createSafePersistStorage failure tolerance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("returns null (in-memory fallback) when getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    const storage = createSafePersistStorage<DemoState>();

    expect(() => storage.getItem(STORAGE_KEYS.cart)).not.toThrow();
    expect(storage.getItem(STORAGE_KEYS.cart)).toBeNull();
  });

  it("never throws when setItem throws (quota exceeded)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const storage = createSafePersistStorage<DemoState>();

    expect(() => storage.setItem(STORAGE_KEYS.cart, demoValue)).not.toThrow();
  });

  it("never throws when removeItem throws", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const storage = createSafePersistStorage<DemoState>();

    expect(() => storage.removeItem(STORAGE_KEYS.cart)).not.toThrow();
  });

  it("never throws when serialization fails", () => {
    const storage = createSafePersistStorage<{ self?: unknown }>();
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(() =>
      storage.setItem(STORAGE_KEYS.cart, {
        state: circular,
        version: STORAGE_VERSION,
      }),
    ).not.toThrow();
  });
});
