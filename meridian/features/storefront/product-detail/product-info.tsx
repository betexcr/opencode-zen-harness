import { StarIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/api/schemas";
import {
  inventoryStatusLabel,
  productInventoryStatus,
  type InventoryStatus,
} from "@/lib/domain/inventory";
import { formatCurrency, toCents } from "@/lib/domain/money";
import {
  clampDiscountPercent,
  hasDiscount,
  productDiscountedPriceCents,
} from "@/lib/domain/pricing";
import { cn } from "@/lib/utils";

import { AddToCart } from "./add-to-cart";

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

export interface ProductInfoProps {
  product: Product;
  className?: string;
}

/**
 * Product information component.
 *
 * Uses domain helpers from lib/domain (money, pricing, inventory).
 * Price/discount/rating/availability render via domain helpers, not ad-hoc math.
 * The sale comparison converts the raw price to integer cents through
 * `toCents`, and the discounted price through `productDiscountedPriceCents`, so
 * the currency-unit/cents boundary stays in `lib/domain/money.ts` rather than
 * being re-derived here. Formatting goes through `formatCurrency`.
 */
export function ProductInfo({ product, className }: ProductInfoProps) {
  const status = productInventoryStatus(product);
  const onSale = hasDiscount(product);
  const discountedCents = productDiscountedPriceCents(product);
  const originalCents = toCents(product.price);
  const discountLabel = `-${Math.round(clampDiscountPercent(product.discountPercentage))}%`;
  const rating = Math.min(5, Math.max(0, product.rating));

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="space-y-3">
        <p className="meridian-overline">
          {product.category.replace(/-/g, " ")}
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-balance sm:text-4xl">
          {product.title}
        </h1>
        {product.brand && (
          <p className="text-lg text-muted-foreground">{product.brand}</p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <span
            className="inline-flex items-center gap-1.5"
            aria-label={`Rated ${rating.toFixed(1)} out of 5`}
          >
            <StarIcon
              className="size-4 fill-warning text-warning"
              aria-hidden="true"
            />
            <span className="font-medium">{rating.toFixed(1)}</span>
            <span className="text-muted-foreground">
              ({product.reviews.length} reviews)
            </span>
          </span>
          <Badge
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
              inventoryBadgeClass(status),
            )}
          >
            {inventoryStatusLabel(status)}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-3">
          <span className="font-heading text-2xl font-semibold sm:text-3xl">
            {formatCurrency(discountedCents)}
          </span>
          {onSale && originalCents > discountedCents && (
            <span className="text-lg text-muted-foreground line-through">
              {formatCurrency(originalCents)}
            </span>
          )}
        </div>
        {onSale && (
          <Badge variant="secondary" className="w-fit">
            {discountLabel} off
          </Badge>
        )}
      </div>

      <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
        {product.description}
      </p>

      <div className="space-y-3 border-t border-border pt-6">
        <AddToCart key={product.id} product={product} />
      </div>

      <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">SKU</h3>
          <p className="mt-1 text-sm text-muted-foreground">{product.sku}</p>
        </div>
        {product.weight !== undefined && (
          <div>
            <h3 className="text-sm font-medium">Weight</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.weight} kg
            </p>
          </div>
        )}
        <div>
          <h3 className="text-sm font-medium">Dimensions</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.dimensions.width} × {product.dimensions.height} ×{" "}
            {product.dimensions.depth} cm
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium">Return Policy</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.returnPolicy}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium">Shipping</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.shippingInformation}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium">Warranty</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.warrantyInformation}
          </p>
        </div>
      </div>

      {product.tags.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
