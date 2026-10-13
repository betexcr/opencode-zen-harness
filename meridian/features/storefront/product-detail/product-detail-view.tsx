"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduct } from "@/features/storefront/queries/use-product";
import { toErrorMessage } from "@/lib/api/client";
import type { Product } from "@/lib/api/schemas";
import { cn } from "@/lib/utils";

import { ProductGallery } from "./product-gallery";
import { ProductInfo } from "./product-info";
import { ProductReviews } from "./product-reviews";

export interface ProductDetailViewProps {
  /** Product id from the route param. */
  id: number;
  /**
   * Optional Cache Components seed the server renders into the static shell.
   * When present the first client render matches the server; when absent the
   * query fetches the same product and the view shows its loading/error states.
   */
  initialData?: Product;
}

/**
 * Loading placeholder for a product detail page.
 *
 * Mirrors the two-column detail layout (square gallery beside the info column)
 * plus the reviews section so the page does not shift when the data resolves.
 * It is decorative and hidden from assistive technology; the wrapping region
 * announces loading through `role="status"`.
 */
export function ProductDetailSkeleton() {
  return (
    <div>
      <span role="status" className="sr-only">
        Loading product
      </span>
      <div className="grid gap-10 lg:grid-cols-2" aria-hidden="true">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-7 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-4 h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </div>
      <div className="mt-16 flex flex-col gap-4 border-t border-border pt-10" aria-hidden="true">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Product detail view.
 *
 * Client-side by design, matching the `ProductGrid` convention: TanStack Query
 * owns the request lifecycle so loading, error, and retry are real, interactive
 * states rather than static markup. Data flows through the typed, Zod-validated
 * `useProduct` query; the component never calls `fetch` directly.
 *
 * Presentation is composed from the task-9 pieces — {@link ProductGallery},
 * {@link ProductInfo} (which owns the add-to-cart/wishlist controls), and
 * {@link ProductReviews} — so every field is rendered from domain helpers rather
 * than ad-hoc math. `initialData` is the optional server seed; when it is absent
 * the query fetches the same product and the skeleton shows until it resolves.
 */
export function ProductDetailView({ id, initialData }: ProductDetailViewProps) {
  const { data: product, isPending, isError, error, refetch, isFetching } =
    useProduct(id, initialData);

  if (isPending) {
    return <ProductDetailSkeleton />;
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface-muted p-8"
      >
        <h1 className="text-lg font-medium">
          We couldn&apos;t load this product.
        </h1>
        <p className="text-sm text-muted-foreground">{toErrorMessage(error)}</p>
        <Button
          type="button"
          variant="outline"
          disabled={isFetching}
          onClick={() => {
            void refetch();
          }}
        >
          {isFetching ? "Retrying…" : "Try again"}
        </Button>
      </div>
    );
  }

  if (!product) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-surface-muted px-6 py-16 text-center"
      >
        <h1 className="font-heading text-lg font-semibold">
          Product not found
        </h1>
        <p className="max-w-sm text-pretty text-sm text-muted-foreground">
          We couldn&apos;t find a product with that id. It may have been removed
          from the catalogue.
        </p>
        <Link
          href="/products"
          className={cn(buttonVariants({ size: "lg" }), "mt-2")}
        >
          Browse the catalogue
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery
          images={product.images}
          thumbnail={product.thumbnail}
          title={product.title}
        />
        <ProductInfo product={product} />
      </div>

      <section
        aria-label="Customer reviews"
        className="mt-16 border-t border-border pt-10"
      >
        <ProductReviews reviews={product.reviews} />
      </section>
    </div>
  );
}
