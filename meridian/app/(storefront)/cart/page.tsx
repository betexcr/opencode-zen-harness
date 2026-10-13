"use client";

import Link from "next/link";

import { ShoppingBagIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CartSummary } from "@/features/storefront/cart/cart-summary";
import { CartTable } from "@/features/storefront/cart/cart-table";
import { useHydrated } from "@/hooks/use-hydrated";
import { selectCartLines, useCartStore } from "@/lib/state";
import { cn } from "@/lib/utils";

/**
 * Cart page.
 *
 * The cart is LOCAL, persisted browser state, so this route is a client
 * component whose store reads are gated behind `useHydrated`: the server render
 * never touches `localStorage`, and the first client render shows a neutral
 * loading state until the persisted lines have rehydrated. When hydrated, the
 * page renders the line-item table ({@link CartTable}) beside the order summary
 * ({@link CartSummary}); both derive every amount from `lib/domain/cart`, so the
 * totals here always match `estimateOrderTotals`. An empty cart shows a prompt
 * that links back to the catalogue.
 */

function CartLoading() {
  return (
    <div aria-busy="true">
      <span role="status" className="sr-only">
        Loading your cart
      </span>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="size-20 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3.5 w-24" />
              </div>
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div
      role="status"
      className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-surface-muted px-6 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-surface text-muted-foreground">
        <ShoppingBagIcon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="font-heading text-lg font-semibold">Your cart is empty</h2>
      <p className="max-w-sm text-pretty text-sm text-muted-foreground">
        Nothing is saved in this browser yet. Browse the catalogue to add
        something.
      </p>
      <Link
        href="/products"
        className={cn(buttonVariants({ size: "lg" }), "mt-2 gap-1.5")}
      >
        Browse products
      </Link>
    </div>
  );
}

export function CartPage() {
  const hydrated = useHydrated();
  const lines = useCartStore(selectCartLines);

  return (
    <div className="mx-auto w-full max-w-[var(--container-editorial)] px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <p className="meridian-overline">Your cart</p>
        <h1 className="mt-2 text-display-sm font-semibold text-balance">
          Shopping cart
        </h1>
      </header>

      {!hydrated ? (
        <CartLoading />
      ) : lines.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <CartTable lines={lines} />
          <CartSummary lines={lines} />
        </div>
      )}
    </div>
  );
}

export default CartPage;
