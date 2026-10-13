"use client";

import Image from "next/image";

import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  cartActions,
  minimumOrderQuantityOf,
} from "@/features/storefront/cart/cart-actions";
import { lineSubtotalCents, lineTotalCents, type CartLine } from "@/lib/domain/cart";
import type { InventoryInput } from "@/lib/domain/inventory";
import { formatCurrency } from "@/lib/domain/money";

/**
 * A single editable line in the persistent cart drawer.
 *
 * Presentation only: every price is resolved through the pure `lib/domain/cart`
 * money helpers, and every mutation flows through the shared `cartActions`
 * surface (task-5 helpers) so the minimum-order-quantity and stock rules that
 * keep a line orderable are expressed exactly once. The stepper step is the
 * line's minimum order quantity, and when the line carries the stock captured
 * at add-to-cart time the steppers can never exceed what is on hand.
 */

/** Stock sentinel for a line with no captured stock, meaning "unbounded". */
const UNBOUNDED_STOCK = Number.MAX_SAFE_INTEGER;

/** Derive an inventory input from a persisted line, tolerating missing stock. */
function lineInventory(line: CartLine): InventoryInput {
  const stock =
    typeof line.stock === "number" && Number.isFinite(line.stock)
      ? line.stock
      : UNBOUNDED_STOCK;
  return { stock, minimumOrderQuantity: line.minimumOrderQuantity };
}

export function CartLineItem({ line }: { line: CartLine }) {
  const inventory = lineInventory(line);
  const step = minimumOrderQuantityOf(inventory);

  const originalUnitCents = lineSubtotalCents({ ...line, quantity: 1 });
  const discountedUnitCents = lineTotalCents({ ...line, quantity: 1 });
  const lineTotal = lineTotalCents(line);
  const onSale = originalUnitCents > discountedUnitCents;

  const canIncrement = cartActions.canIncrement(line, inventory);
  const canDecrement = cartActions.canDecrement(line, inventory);

  return (
    <li className="flex gap-4 py-4">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-sunken">
        {line.thumbnail ? (
          <Image
            src={line.thumbnail}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-sm font-medium text-foreground">
            {line.title}
          </p>
          <button
            type="button"
            onClick={() => {
              cartActions.remove(line.productId);
            }}
            className="meridian-focus shrink-0 rounded-sm text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Remove
          </button>
        </div>

        <p className="mt-0.5 flex items-baseline gap-2 text-xs text-muted-foreground">
          {onSale ? (
            <span className="line-through">
              {formatCurrency(originalUnitCents)}
            </span>
          ) : null}
          <span>{formatCurrency(discountedUnitCents)} each</span>
        </p>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              aria-label={`Decrease quantity of ${line.title}`}
              disabled={!canDecrement}
              onClick={() => {
                cartActions.decrement(line, inventory, step);
              }}
            >
              <MinusIcon aria-hidden="true" />
            </Button>
            <span
              className="min-w-6 text-center text-sm tabular-nums"
              aria-live="polite"
            >
              {line.quantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              aria-label={`Increase quantity of ${line.title}`}
              disabled={!canIncrement}
              onClick={() => {
                cartActions.increment(line, inventory, step);
              }}
            >
              <PlusIcon aria-hidden="true" />
            </Button>
          </div>
          <span className="text-sm font-medium tabular-nums">
            {formatCurrency(lineTotal)}
          </span>
        </div>

        {step > 1 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Minimum order quantity: {step}
          </p>
        ) : null}
      </div>
    </li>
  );
}
