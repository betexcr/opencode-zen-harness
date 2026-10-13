import { Suspense } from "react";

import { cacheLife } from "next/cache";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ProductDetailSkeleton,
  ProductDetailView,
} from "@/features/storefront/product-detail/product-detail-view";
import { isApiError } from "@/lib/api/client";
import { getProduct, getProducts } from "@/lib/api/products";
import type { Product } from "@/lib/api/schemas";

/**
 * Product detail route.
 *
 * A SERVER component. `generateStaticParams` asks the typed catalogue client for
 * a page of real products and pre-renders each of their ids, so the most
 * frequently visited product pages are ready ahead of the first request. Any id
 * outside that set is still resolvable on demand — Cache Components upgrades it
 * after the first visit — while an id the API reports as missing renders the
 * not-found state instead of crashing.
 *
 * Cache Components note: with `cacheComponents` enabled, route-segment data must
 * be cached for a route to be statically prerendered, so the single-product read
 * is wrapped in a `"use cache"` function (`loadProduct`). `params` is read at the
 * top of the page and the client view is wrapped in one `<Suspense>` (Cache
 * Components requires a boundary around client components that read unstable
 * values such as `Date.now()`), so known ids — whose params come from
 * `generateStaticParams` — prerender in full. Nothing here touches `window` or
 * `localStorage`; the interactive add-to-cart/wishlist controls live in the
 * client `ProductDetailView`.
 *
 * Not-found behaviour: invalid/unknown ids are resolved before render and call
 * `notFound()`, which renders the not-found UI and injects a `noindex` tag. This
 * is a Partial Prerender route, so an on-demand id is served by streaming the
 * param-specific segment; Next documents that `notFound()` invoked after
 * streaming starts keeps the response status at `200` (the not-found UI streams
 * in). Returning a true `404` status would require a pre-stream existence check
 * such as a Proxy/middleware lookup, which is out of scope for this route.
 *
 * ISR note (documented deviation): the task contract asks for
 * `export const revalidate`, but this app has `cacheComponents: true` and Next
 * 16.4 rejects that route-segment export (`Route segment config "revalidate" is
 * not compatible with nextConfig.cacheComponents`). Its intent — ISR-style
 * revalidation of the pre-rendered product pages — is expressed here by the
 * Cache Components equivalent: `generateStaticParams` (getStaticPaths) plus
 * `"use cache"` + `cacheLife("hours")` on the product read (getStaticProps'
 * revalidate). The export cannot be restored without disabling Cache Components
 * app-wide, so it is intentionally omitted to keep the production build green.
 */

/**
 * `params` is awaited at the top of this server component, so the route is
 * allowed to block on navigation; opt out of instant-navigation validation.
 */
export const instant = false;

/** How many product ids `generateStaticParams` pre-renders from the catalogue. */
const STATIC_PARAM_LIMIT = 30;

/**
 * Minimum non-empty set used if the catalogue cannot be reached at build time.
 * Cache Components requires `generateStaticParams` to return at least one entry,
 * so this keeps an offline build from failing; the real ids come from the
 * fetched list whenever the API is reachable.
 */
const FALLBACK_STATIC_PARAMS: readonly { id: string }[] = [{ id: "1" }];

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

/** Fetch the ids that should be pre-rendered at build time. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  try {
    const { products } = await getProducts({ limit: STATIC_PARAM_LIMIT });
    const params = products.map((product) => ({ id: String(product.id) }));
    return params.length > 0 ? params : [...FALLBACK_STATIC_PARAMS];
  } catch {
    return [...FALLBACK_STATIC_PARAMS];
  }
}

/**
 * Cached single-product read.
 *
 * `"use cache"` promotes the validated `getProduct` result into the route's
 * static shell so known ids prerender; `cacheLife("hours")` matches the
 * slow-changing catalogue. A genuine 404 (the API reports the id does not exist)
 * resolves to `null` so the route can render the not-found state; any other
 * failure — network, timeout, malformed payload — is rethrown rather than
 * masquerading as a missing product, so a transient outage surfaces as an error
 * instead of a misleading 404.
 */
async function loadProduct(id: number): Promise<Product | null> {
  "use cache";
  cacheLife("hours");

  try {
    return await getProduct(id);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/** Normalize and validate the raw route id, or `null` when it is not usable. */
function parseProductId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const productId = parseProductId(id);
  if (productId === null) {
    return { title: "Product not found" };
  }

  const product = await loadProduct(productId);
  if (!product) {
    return { title: "Product not found" };
  }

  return {
    title: product.title,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  const productId = parseProductId(id);
  if (productId === null) {
    notFound();
  }

  const product = await loadProduct(productId);
  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-[var(--container-editorial)] px-4 py-12 sm:px-6 sm:py-16">
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetailView id={productId} initialData={product} />
      </Suspense>
    </div>
  );
}
