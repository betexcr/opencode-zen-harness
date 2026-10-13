"use client";

import { useState, useMemo } from "react";
import { MinusIcon, PlusIcon, HeartIcon, ShoppingCartIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  cartActions,
  cartLineBounds,
  minimumOrderQuantityOf,
} from "@/features/storefront/cart/cart-actions";
import { wishlistActions } from "@/features/storefront/wishlist/wishlist-actions";
import type { Product } from "@/lib/api/schemas";
import { isOutOfStock, type InventoryInput } from "@/lib/domain/inventory";
import { cn } from "@/lib/utils";
import { useWishlistStore } from "@/lib/state";
import { useHydrated } from "@/hooks/use-hydrated";

export interface AddToCartProps {
  product: Product;
  className?: string;
}

/**
 * Add to cart component with quantity selector and wishlist toggle.
 *
 * Mutations go through task-5 helpers (cartActions, wishlistActions).
 * Quantity selector honors minimumOrderQuantity and available stock.
 * SSR-safe via useHydrated for wishlist state.
 */
export function AddToCart({ product, className }: AddToCartProps) {
  const hydrated = useHydrated();
  const wishlistIds = useWishlistStore((s) => s.ids);
  const isWishlisted = wishlistIds.includes(product.id);

  const inventory: InventoryInput = {
    stock: product.stock,
    minimumOrderQuantity: product.minimumOrderQuantity,
  };

  const { minimum, maximum } = cartLineBounds(inventory);
  const step = minimumOrderQuantityOf(inventory);
  const outOfStock = isOutOfStock(inventory);
  const canOrder = maximum >= minimum && !outOfStock;

  const [quantity, setQuantity] = useState(canOrder ? minimum : 0);

  const canIncrement = useMemo(
    () => canOrder && quantity < maximum,
    [canOrder, quantity, maximum],
  );
  const canDecrement = useMemo(
    () => canOrder && quantity > minimum,
    [canOrder, quantity, minimum],
  );

  const handleIncrement = () => {
    if (!canIncrement) return;
    const next = Math.min(quantity + step, maximum);
    setQuantity(next);
  };

  const handleDecrement = () => {
    if (!canDecrement) return;
    const next = Math.max(quantity - step, minimum);
    setQuantity(next);
  };

  const handleAddToCart = () => {
    if (!canOrder) return;
    cartActions.add(
      {
        id: product.id,
        title: product.title,
        thumbnail: product.thumbnail,
        price: product.price,
        discountPercentage: product.discountPercentage,
        stock: product.stock,
        minimumOrderQuantity: product.minimumOrderQuantity,
      },
      quantity,
    );
  };

  const handleWishlistToggle = () => {
    wishlistActions.toggle(product.id);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {canOrder && (
        <div className="flex items-center gap-3">
          <label htmlFor="quantity" className="text-sm font-medium">
            Quantity
          </label>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Decrease quantity"
              disabled={!canDecrement}
              onClick={handleDecrement}
            >
              <MinusIcon aria-hidden="true" />
            </Button>
            <input
              id="quantity"
              type="number"
              value={quantity}
              readOnly
              className="w-12 border-0 bg-transparent text-center text-sm focus:outline-none"
              aria-label="Quantity"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Increase quantity"
              disabled={!canIncrement}
              onClick={handleIncrement}
            >
              <PlusIcon aria-hidden="true" />
            </Button>
          </div>
          {step > 1 && (
            <span className="text-xs text-muted-foreground">
              MOQ: {step}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          disabled={!canOrder}
          onClick={handleAddToCart}
        >
          <ShoppingCartIcon aria-hidden="true" />
          {outOfStock ? "Out of stock" : "Add to cart"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full sm:w-auto"
          onClick={handleWishlistToggle}
          disabled={!hydrated}
        >
          <HeartIcon
            className={cn(
              "size-4",
              hydrated && isWishlisted ? "fill-current" : "",
            )}
            aria-hidden="true"
          />
          {hydrated && isWishlisted ? "In wishlist" : "Add to wishlist"}
        </Button>
      </div>
    </div>
  );
}
