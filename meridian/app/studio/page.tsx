import Link from "next/link";

import { ArrowUpRightIcon, StoreIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WORKSPACE_AREAS = [
  {
    title: "Catalogue",
    body: "Edit the shared product record, adjust pricing, and reconcile remote sample data with local overrides.",
  },
  {
    title: "Inventory",
    body: "Read stock levels against low-stock thresholds and surface what needs attention first.",
  },
  {
    title: "Merchandising",
    body: "Control how the storefront surfaces featured products without duplicating catalogue state.",
  },
  {
    title: "Orders",
    body: "Review locally persisted demo orders and the cart line math that produces them.",
  },
] as const;

/**
 * Merchant workspace overview.
 *
 * Renders inside {@link StudioShell} for the `/studio` route. It states the
 * scope of the workspace and links back to the shop; the individual merchant
 * modules it names are delivered in later milestones.
 */
export default function StudioOverviewPage() {
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-4">
        <p className="meridian-overline">Meridian Studio</p>
        <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          The merchant workspace.
        </h1>
        <p className="max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
          Studio is where the catalogue, inventory, merchandising, and demo
          orders are managed. It shares one design system and one state model
          with the storefront.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            <StoreIcon className="size-4" aria-hidden="true" />
            View the shop
          </Link>
        </div>
      </header>

      <section
        aria-labelledby="workspace-areas-heading"
        className="flex flex-col gap-6"
      >
        <h2 id="workspace-areas-heading" className="meridian-overline">
          Workspace areas
        </h2>
        <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          {WORKSPACE_AREAS.map((area) => (
            <li
              key={area.title}
              className="flex flex-col gap-2 bg-surface-raised p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-base font-semibold">{area.title}</h3>
                <ArrowUpRightIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <p className="text-pretty text-sm text-muted-foreground">
                {area.body}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          These modules build on the shared catalogue and persistent state
          established in the application foundation.
        </p>
      </section>
    </div>
  );
}
