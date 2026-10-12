import type { PersistStorage, StorageValue } from "zustand/middleware";

/**
 * Persistence primitives shared by every Meridian Zustand store.
 *
 * Stores persist only LOCAL, user-owned application state via `persist`. Remote
 * DummyJSON sample data is never written here. Persistence is hydration-safe
 * (every store passes `skipHydration: true` and rehydrates on the client) and
 * failure-tolerant: any read/write/parse error degrades to in-memory state
 * instead of crashing the app (e.g. disabled cookies, storage quota, corrupted
 * JSON).
 */

/** Schema version for all persisted stores; bump when a migration is needed. */
export const STORAGE_VERSION = 1;

/** Canonical, namespaced localStorage keys. One key per store. */
export const STORAGE_KEYS = {
  cart: "meridian.cart",
  wishlist: "meridian.wishlist",
  overrides: "meridian.overrides",
  createdProducts: "meridian.created-products",
  merchandising: "meridian.merchandising",
  orders: "meridian.orders",
  preferences: "meridian.preferences",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Resolve the browser storage, or `null` when unavailable (SSR, disabled
 * storage, or an accessor that throws in restricted privacy modes).
 */
function resolveStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function safeGetItem(name: string): string | null {
  try {
    return resolveStorage()?.getItem(name) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(name: string, value: string): void {
  try {
    resolveStorage()?.setItem(name, value);
  } catch {
    // Ignore write failures (quota exceeded, storage disabled, ...).
  }
}

function safeRemoveItem(name: string): void {
  try {
    resolveStorage()?.removeItem(name);
  } catch {
    // Ignore removal failures.
  }
}

/**
 * Create a failure-tolerant {@link PersistStorage} for a store whose state is
 * `T`. Reads return `null` (in-memory fallback) on any error or malformed
 * payload; writes/removals never throw.
 */
export function createSafePersistStorage<T>(): PersistStorage<T> {
  return {
    getItem: (name: string): StorageValue<T> | null => {
      const raw = safeGetItem(name);
      if (raw === null) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          !("state" in parsed)
        ) {
          return null;
        }
        return parsed as StorageValue<T>;
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: StorageValue<T>): void => {
      try {
        safeSetItem(name, JSON.stringify(value));
      } catch {
        // Ignore serialization failures; state stays in memory.
      }
    },
    removeItem: (name: string): void => {
      safeRemoveItem(name);
    },
  };
}
