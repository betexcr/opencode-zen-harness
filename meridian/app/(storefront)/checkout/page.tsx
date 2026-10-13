"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { CheckoutWizard } from "@/features/storefront/checkout/checkout-wizard";
import { useHydrated } from "@/hooks/use-hydrated";
import { selectCartLines, useCartStore } from "@/lib/state";

/**
 * Checkout page.
 *
 * The cart is LOCAL, persisted browser state, so this route is a client
 * component whose store reads are gated behind `useHydrated`: the server render
 * never touches `localStorage`, and the first client render shows a neutral
 * loading shell instead of the wizard or a redirect (so there is no SSR
 * flash). Once hydrated, an empty cart redirects to `/cart` before the wizard
 * is ever mounted.
 *
 * After an order is placed the cart is cleared, so the guard would otherwise
 * fire on the now-empty cart. `orderPlaced` records that completion and keeps
 * {@link CheckoutWizard} on screen so its order-confirmation state remains
 * visible.
 */
function CheckoutLoading() {
  return (
    <div
      aria-busy="true"
      className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <span role="status" className="sr-only">
        Loading checkout
      </span>
      <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="mt-2 h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-4 h-9 w-32 self-end" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

export function CheckoutPage() {
  const hydrated = useHydrated();
  const lines = useCartStore(selectCartLines);
  const router = useRouter();
  const [orderPlaced, setOrderPlaced] = useState(false);

  const redirecting = hydrated && !orderPlaced && lines.length === 0;

  useEffect(() => {
    if (redirecting) router.replace("/cart");
  }, [redirecting, router]);

  return (
    <div className="mx-auto w-full max-w-[var(--container-editorial)] px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <p className="meridian-overline">Checkout</p>
        <h1 className="mt-2 text-display-sm font-semibold text-balance">
          Complete your order
        </h1>
      </header>

      {!hydrated || redirecting ? (
        <CheckoutLoading />
      ) : (
        <CheckoutWizard onOrderPlaced={() => setOrderPlaced(true)} />
      )}
    </div>
  );
}

export default CheckoutPage;
