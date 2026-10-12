"use client";

import { useEffect, useState } from "react";
import { rehydrateAllStores } from "@/lib/state";

/**
 * Client-only hydration gate for Meridian's persisted Zustand stores.
 *
 * Every store is created with `skipHydration: true`, so nothing touches
 * `localStorage` during module evaluation or SSR rendering. This hook, mounted
 * by the app providers, triggers rehydration once on the client and reports
 * when persisted state has been applied.
 *
 * Consumers use the returned boolean to defer rendering of persisted values
 * until hydration completes, which avoids server/client markup mismatches for
 * cart counts, wishlist flags, and similar state.
 *
 * Hydration is attempted exactly once per mount; failures inside the
 * failure-tolerant storage layer degrade to in-memory state rather than
 * throwing, so the flag still flips to `true`.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void rehydrateAllStores().finally(() => {
      if (active) setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return hydrated;
}
