import Link from "next/link";

import { CheckIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { formatCurrency } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

/**
 * Order-confirmation state for the demo checkout flow.
 *
 * Rendered by the wizard once an order has been persisted to the local
 * `orders` store. It is presentational only: it reads nothing from React state,
 * the network, or the stores and receives the assigned order number, the
 * recipient name, and the frozen demo total as props, so the confirmation
 * simply reflects what was actually saved. No payment is processed and nothing
 * ships.
 */

/** A persisted demo order, reduced to what the confirmation renders. */
export interface PlacedOrder {
  /** Local order number assigned by the orders store. */
  number: number;
  /** Recipient name captured from the checkout contact step. */
  recipient: string;
  /** Frozen demo order total, in integer cents. */
  totalCents: number;
}

/** Success panel shown after the cart has been converted into an order. */
export function OrderConfirmation({ order }: { order: PlacedOrder }) {
  return (
    <div
      role="status"
      className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-border bg-surface px-6 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-success-muted text-success-muted-foreground">
        <CheckIcon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="font-heading text-2xl font-semibold">Order placed</h2>
      <p className="max-w-md text-pretty text-sm text-muted-foreground">
        {order.recipient ? `Thank you, ${order.recipient}. ` : "Thank you. "}
        This is a demo order. No payment was processed and nothing will ship.
      </p>
      <dl className="mt-2 flex flex-col gap-1 text-sm">
        <div className="flex items-baseline justify-center gap-2">
          <dt className="text-muted-foreground">Order number</dt>
          <dd className="font-medium tabular-nums">#{order.number}</dd>
        </div>
        <div className="flex items-baseline justify-center gap-2">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="font-medium tabular-nums">
            {formatCurrency(order.totalCents)}
          </dd>
        </div>
      </dl>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Link href="/products" className={cn(buttonVariants({ size: "lg" }))}>
          Continue shopping
        </Link>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
