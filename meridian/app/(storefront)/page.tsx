import { Suspense } from "react";

import Link from "next/link";

import { ArrowRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { ProductGrid } from "@/features/storefront/components/product-grid";
import { ProductGridSkeleton } from "@/features/storefront/components/product-grid-skeleton";
import { getFeaturedProducts } from "@/features/storefront/queries/featured-products";
import { cn } from "@/lib/utils";

/**
 * Cache Components seed for the featured edit.
 *
 * The server renders the cached, Zod-validated edit into the static shell and
 * hands it to the client grid as `initialData`. If no seed is available the
 * client query fetches the same edit and shows the skeleton until it resolves.
 */
async function FeaturedProducts() {
  const initialData = await getFeaturedProducts();
  return <ProductGrid initialData={initialData ?? undefined} />;
}

/**
 * Storefront home.
 *
 * A server component that establishes the editorial voice and then hands off
 * the live catalogue section to {@link ProductGrid}, which owns the client-side
 * request lifecycle (loading, empty, error, retry) through TanStack Query. The
 * only navigation is to `/studio`, a route that exists — there are no dead
 * links or placeholder controls.
 */
export function StorefrontHomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-[var(--container-editorial)] px-4 py-16 sm:px-6 sm:py-24">
          <p className="meridian-overline">Meridian Commerce OS</p>
          <h1 className="mt-4 max-w-3xl text-display-sm font-semibold text-balance sm:text-display-md">
            Retail, composed with intent.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            A curated edit of what the catalogue does best, drawn live from the
            Meridian sample API and validated at the edge of the data layer.
          </p>
          <div className="mt-8">
            <Link
              href="/studio"
              className={cn(buttonVariants({ size: "lg" }), "gap-1.5")}
            >
              Open Meridian Studio
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="featured-heading"
        className="mx-auto w-full max-w-[var(--container-editorial)] px-4 py-16 sm:px-6 sm:py-24"
      >
        <h2 id="featured-heading" className="meridian-overline">
          Featured
        </h2>
        <p className="mt-2 max-w-lg text-pretty text-lg text-muted-foreground">
          The highest-rated products in the Meridian catalogue right now.
        </p>
        <div className="mt-8">
          <Suspense
            fallback={
              <div>
                <span role="status" className="sr-only">
                  Loading featured products
                </span>
                <ProductGridSkeleton />
              </div>
            }
          >
            <FeaturedProducts />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

export default StorefrontHomePage;
