"use client";

import { useSyncExternalStore } from "react";

/**
 * Module-level no-op subscription.
 *
 * Stable across renders, so `useSyncExternalStore` never re-subscribes. The
 * store never changes; this is used purely to obtain a client-only snapshot.
 */
const subscribe = () => () => {};

/**
 * Renders the current calendar year on the client only.
 *
 * `new Date()` is an unstable value: reading it during the server prerender
 * trips Cache Components ("encountered the unstable value `new Date()` while
 * prerendering"). `useSyncExternalStore` returns the server snapshot (`null`)
 * during SSR and the hydration pass, then the live year once mounted on the
 * client. The value is therefore computed later, on the client, with no
 * hydration mismatch.
 */
export function CopyrightYear() {
  const year = useSyncExternalStore(
    subscribe,
    () => new Date().getFullYear(),
    () => null,
  );

  return <>{year ?? ""}</>;
}
