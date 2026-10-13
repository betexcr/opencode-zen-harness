"use client";

import Image from "next/image";
import Link from "next/link";

import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  clampLineQuantity,
  lineTotalCents,
  maximumLineQuantity,
  minimumLineQuantity,
  type CartLine,
} from "@/lib/domain/cart";
import { formatCurrency, toCents } from "@/lib/domain/money";
import { useCartStore } from "@/lib/state";

/**
 * Cart line-item table.
 *
 * Presentation only: quantities are clamped through `lib/domain/cart`
 * (`clampLineQuantity`, honouring each line's minimum order quantity and the
 * captured stock) and every price is rendered from the integer-cent helpers, so
 * the table can never disagree with the totals computed by
 * `estimateOrderTotals`. Edits are dispatched to the persisted cart store.
 */

function CartTableRow({ line }: { line: CartLine }) {
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);

  const minimum = minimumLineQuantity(line);
  const maximum = maximumLineQuantity(line);
  const originalUnitCents = toCents(line.price);
  const discountedUnitCents = lineTotalCents({ ...line, quantity: 1 });
  const hasDiscount = discountedUnitCents !== originalUnitCents;
  const totalCents = lineTotalCents(line);
  const atMinimum = line.quantity <= minimum;
  const atMaximum = Number.isFinite(maximum) && line.quantity >= maximum;
  const showsMinimum =
    typeof line.minimumOrderQuantity === "number" &&
    line.minimumOrderQuantity > 1;

  const updateQuantity = (next: number) => {
    setQuantity(line.productId, clampLineQuantity(line, next));
  };

  return (
    <tr className="border-b border-border align-top last:border-b-0">
      <th scope="row" className="py-4 pr-4 text-left font-normal">
        <div className="flex items-start gap-4">
          <Link
            href={`/products/${line.productId}`}
            className="meridian-focus relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-sunken"
          >
            <Image
              src={line.thumbnail}
              alt={line.title}
              fill
              sizes="80px"
              className="object-cover"
            />
          </Link>
          <div className="min-w-0">
            <Link
              href={`/products/${line.productId}`}
              className="meridian-focus rounded-sm text-sm font-medium text-foreground hover:underline"
            >
              {line.title}
            </Link>
            {showsMinimum ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Minimum order {line.minimumOrderQuantity}
              </p>
            ) : null}
            {Number.isFinite(maximum) ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {maximum} available
              </p>
            ) : null}
          </div>
        </div>
      </th>

      <td className="px-4 py-4">
        <div className="flex flex-col gap-0.5 tabular-nums">
          <span className="text-sm font-medium">
            {formatCurrency(discountedUnitCents)}
          </span>
          {hasDiscount ? (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrency(originalUnitCents)}
            </span>
          ) : null}
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="inline-flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Decrease quantity of ${line.title}`}
            disabled={atMinimum}
            onClick={() => updateQuantity(line.quantity - 1)}
          >
            <MinusIcon aria-hidden="true" />
          </Button>
          <span
            className="min-w-8 text-center text-sm tabular-nums"
            aria-live="polite"
          >
            {line.quantity}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Increase quantity of ${line.title}`}
            disabled={atMaximum}
            onClick={() => updateQuantity(line.quantity + 1)}
          >
            <PlusIcon aria-hidden="true" />
          </Button>
        </div>
      </td>

      <td className="py-4 pl-4 text-right text-sm font-medium tabular-nums">
        {formatCurrency(totalCents)}
      </td>

      <td className="py-4 pl-4 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${line.title} from cart`}
          onClick={() => removeLine(line.productId)}
        >
          <Trash2Icon aria-hidden="true" />
        </Button>
      </td>
    </tr>
  );
}

export function CartTable({ lines }: { lines: readonly CartLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse">
        <caption className="sr-only">Items in your cart</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="py-3 pr-4 font-medium">
              Product
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Unit price
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Quantity
            </th>
            <th scope="col" className="py-3 pl-4 text-right font-medium">
              Line total
            </th>
            <th scope="col" className="py-3 pl-4">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <CartTableRow key={line.productId} line={line} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
