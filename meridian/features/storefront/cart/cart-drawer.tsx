"use client";

import { ShoppingBagIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cartActions } from "@/features/storefront/cart/cart-actions";
import { CartLineItem } from "@/features/storefront/cart/cart-line-item";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatCurrency } from "@/lib/domain/money";
import {
  selectCartEstimate,
  selectCartItemCount,
  selectCartLines,
  useCartStore,
} from "@/lib/state";
import { cn } from "@/lib/utils";

/**
 * Persistent cart drawer.
 *
 * The drawer is the storefront's always-available cart surface, mounted in the
 * header on every route. It reads the persisted cart through the shared
 * selectors (`selectCartLines`, `selectCartItemCount`, `selectCartEstimate`) and
 * mutates it exclusively through the `cartActions` helpers, so the minimum
 * order quantity and stock rules live in exactly one place.
 *
 * HYDRATION SAFETY: the persisted store uses `skipHydration`, so the server and
 * the first client paint render an empty cart. The count badge and the totals
 * are therefore gated behind `useHydrated` and only appear once localStorage has
 * been read, which keeps the first client render identical to the static shell.
 */

/** A single DEMO estimate line in the drawer footer. */
function EstimateRow({
  label,
  value,
  emphasis = false,
  muted = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={cn(muted ? "text-muted-foreground" : "text-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "font-heading text-base font-semibold" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function CartDrawer() {
  const hydrated = useHydrated();
  const lines = useCartStore(selectCartLines);
  const itemCount = useCartStore(selectCartItemCount);
  const estimate = useCartStore(useShallow(selectCartEstimate));

  const hasLines = lines.length > 0;
  const showCount = hydrated && itemCount > 0;

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={showCount ? `Open cart, ${itemCount} items` : "Open cart"}
          />
        }
      >
        <ShoppingBagIcon aria-hidden="true" />
        {showCount ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-brand px-1 text-[0.625rem] font-semibold tabular-nums text-accent-brand-foreground">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        ) : null}
      </SheetTrigger>

      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>
            {!hydrated
              ? "Loading your saved cart…"
              : itemCount > 0
                ? `${itemCount} item${itemCount === 1 ? "" : "s"} saved in this browser.`
                : "Nothing saved yet."}
          </SheetDescription>
        </SheetHeader>

        {hydrated && hasLines ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <ul className="meridian-no-scrollbar flex-1 divide-y divide-border overflow-y-auto px-4">
              {lines.map((line) => (
                <CartLineItem key={line.productId} line={line} />
              ))}
            </ul>

            <SheetFooter className="gap-3 border-t border-border">
              <div className="flex flex-col gap-1.5">
                <EstimateRow
                  label="Subtotal"
                  value={formatCurrency(estimate.subtotalCents)}
                  muted
                />
                {estimate.discountCents > 0 ? (
                  <EstimateRow
                    label="Discount"
                    value={`-${formatCurrency(estimate.discountCents)}`}
                    muted
                  />
                ) : null}
                <EstimateRow
                  label="Shipping (estimated)"
                  value={
                    estimate.shippingCents > 0
                      ? formatCurrency(estimate.shippingCents)
                      : "Free"
                  }
                  muted
                />
                <EstimateRow
                  label={`Tax (estimated, ${estimate.taxRatePercent}%)`}
                  value={formatCurrency(estimate.taxCents)}
                  muted
                />
                <div className="mt-1 border-t border-border pt-2">
                  <EstimateRow
                    label="Estimated total"
                    value={formatCurrency(estimate.totalCents)}
                    emphasis
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Shipping and tax are demonstration estimates shown at checkout.
                This cart lives only in your browser.
              </p>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  cartActions.clear();
                }}
              >
                Clear cart
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBagIcon
              className="size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              {hydrated
                ? "Your cart is empty. Browse the shop to add something."
                : "Loading your cart…"}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
