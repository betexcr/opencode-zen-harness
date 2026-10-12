import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useHydrated } from "@/hooks/use-hydrated";
import {
  STORAGE_KEYS,
  STORAGE_VERSION,
  useCartStore,
} from "@/lib/state";

describe("useHydrated", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [] });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useCartStore.setState({ lines: [] });
    window.localStorage.clear();
  });

  it("reports false before rehydration and true afterwards", async () => {
    const { result } = renderHook(() => useHydrated());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("applies persisted state from storage on mount", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.cart,
      JSON.stringify({
        state: {
          lines: [
            {
              productId: 3,
              title: "Restored",
              thumbnail: "r.webp",
              price: 5,
              discountPercentage: 0,
              quantity: 2,
            },
          ],
        },
        version: STORAGE_VERSION,
      }),
    );

    const { result } = renderHook(() => useHydrated());
    await waitFor(() => expect(result.current).toBe(true));
    expect(useCartStore.getState().lines[0]?.productId).toBe(3);
  });

  it("still reports hydrated when storage access throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { result } = renderHook(() => useHydrated());
    await waitFor(() => expect(result.current).toBe(true));
    expect(useCartStore.getState().lines).toEqual([]);
  });
});
