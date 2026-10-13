import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { estimateOrderTotals, type CartLine } from "@/lib/domain/cart";
import { formatCurrency } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

/**
 * Cart order summary.
 *
 * Every figure is produced by `estimateOrderTotals` in `lib/domain/cart`, the
 * single source of truth for cart math, so the summary can never drift from the
 * line items in {@link CartTable}. Shipping and tax are DEMONSTRATION estimates
 * (flat/distance-free thresholds and a tax ladder), so they are labelled as
 * such. This is a pure presentation component; it holds no state.
 */

function SummaryRow({
  label,
  value,
  muted = false,
  note,
}: {
  label: string;
  value: string;
  muted?: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-sm", muted ? "text-muted-foreground" : "text-foreground")}>
        {label}
        {note ? (
          <span className="ml-1 text-xs text-muted-foreground">{note}</span>
        ) : null}
      </dt>
      <dd
        className={cn(
          "text-sm tabular-nums",
          muted ? "text-muted-foreground" : "font-medium text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function CartSummary({ lines }: { lines: readonly CartLine[] }) {
  const estimate = estimateOrderTotals(lines);
  const shippingLabel =
    estimate.shippingCents === 0
      ? "Free"
      : formatCurrency(estimate.shippingCents);

  return (
    <aside
      aria-labelledby="cart-summary-heading"
      className="rounded-xl border border-border bg-surface p-6"
    >
      <h2
        id="cart-summary-heading"
        className="font-heading text-lg font-semibold"
      >
        Order summary
      </h2>

      <dl className="mt-6 flex flex-col gap-3">
        <SummaryRow
          label="Subtotal"
          value={formatCurrency(estimate.subtotalCents)}
          muted
        />
        {estimate.discountCents > 0 ? (
          <SummaryRow
            label="Discount"
            value={`-${formatCurrency(estimate.discountCents)}`}
            muted
          />
        ) : null}
        <SummaryRow
          label="Shipping"
          note="(estimated)"
          value={shippingLabel}
          muted
        />
        <SummaryRow
          label="Tax"
          note={`(estimated, ${estimate.taxRatePercent}%)`}
          value={formatCurrency(estimate.taxCents)}
          muted
        />
        <div className="mt-2 border-t border-border pt-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-heading text-base font-semibold">Total</dt>
            <dd className="font-heading text-base font-semibold tabular-nums">
              {formatCurrency(estimate.totalCents)}
            </dd>
          </div>
        </div>
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">
        Shipping and tax are demonstration estimates, not real carrier rates or
        tax law. This cart lives only in your browser.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/checkout"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Proceed to checkout
        </Link>
        <Link
          href="/products"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full",
          )}
        >
          Continue shopping
        </Link>
      </div>
    </aside>
  );
}
