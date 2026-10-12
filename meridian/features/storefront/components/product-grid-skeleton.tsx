import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for the featured product grid.
 *
 * It mirrors the real grid's column rhythm and each tile's element order
 * (square image, overline, title, brand, description, price row) so the layout
 * does not shift when the data resolves. It is decorative and hidden from
 * assistive technology; the surrounding region announces loading via
 * `role="status"`.
 */

/** Matches the featured grid's default column count at the widest breakpoint. */
export const PRODUCT_GRID_SKELETON_COUNT = 8;

export function ProductGridSkeleton({
  count = PRODUCT_GRID_SKELETON_COUNT,
}: {
  count?: number;
}) {
  return (
    <ul
      className="grid list-none grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <li key={index} className="flex flex-col">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="mt-4 flex flex-1 flex-col">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-2 h-4 w-4/5" />
            <Skeleton className="mt-1.5 h-3.5 w-24" />
            <Skeleton className="mt-2.5 h-3.5 w-full" />
            <Skeleton className="mt-1.5 h-3.5 w-2/3" />
            <Skeleton className="mt-auto h-5 w-24" />
          </div>
        </li>
      ))}
    </ul>
  );
}
