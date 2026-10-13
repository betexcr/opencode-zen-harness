import Image from "next/image";
import Link from "next/link";

import { StarIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/api/schemas";
import {
  inventoryStatusLabel,
  productInventoryStatus,
  type InventoryStatus,
} from "@/lib/domain/inventory";
import { formatAmount } from "@/lib/domain/money";
import { discountedPrice, hasDiscount } from "@/lib/domain/pricing";
import { cn } from "@/lib/utils";

/**
 * Editorial product tile.
 *
 * Presentation only: every price, discount, and inventory figure is resolved
 * through the pure domain modules (`lib/domain`) so no business math lives in
 * the component. The whole tile links through to its product detail route so
 * the catalogue has a single, reliable entry point into the shopping flow.
 */

function inventoryBadgeClass(status: InventoryStatus): string {
  switch (status) {
    case "out-of-stock":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "low-stock":
      return "border-warning/40 bg-warning-muted text-warning-muted-foreground";
    default:
      return "border-success/30 bg-success-muted text-success-muted-foreground";
  }
}

export function ProductCard({ product }: { product: Product }) {
  const status = productInventoryStatus(product);
  const discounted = discountedPrice(product.price, product.discountPercentage);
  const onSale = hasDiscount(product);
  const discountLabel = `-${Math.round(product.discountPercentage)}%`;
  const rating = Math.min(5, Math.max(0, product.rating));

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex h-full flex-col rounded-xl outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
    >
      <article className="flex h-full flex-col">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-sunken">
          <Image
            src={product.thumbnail}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
          />
          {onSale ? (
            <Badge className="absolute left-3 top-3 border-accent-brand/40 bg-accent-brand text-accent-brand-foreground">
              {discountLabel}
            </Badge>
          ) : null}
        </div>

        <div className="mt-4 flex flex-1 flex-col">
          <p className="meridian-overline">{product.category.replace(/-/g, " ")}</p>
          <h3 className="mt-1 text-base font-medium leading-snug text-balance">
            {product.title}
          </h3>
          {product.brand ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{product.brand}</p>
          ) : null}
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {product.description}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1 text-sm"
              aria-label={`Rated ${rating.toFixed(1)} out of 5`}
            >
              <StarIcon
                className="size-3.5 fill-current text-warning"
                aria-hidden="true"
              />
              <span className="font-medium">{rating.toFixed(1)}</span>
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                inventoryBadgeClass(status),
              )}
            >
              {inventoryStatusLabel(status)}
            </span>
          </div>

          <div className="mt-auto flex items-baseline gap-2 pt-3">
            <span className="font-heading text-lg font-semibold">
              {formatAmount(discounted)}
            </span>
            {onSale ? (
              <span className="text-sm text-muted-foreground line-through">
                {formatAmount(product.price)}
              </span>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
}
