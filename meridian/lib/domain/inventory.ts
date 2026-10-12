import type { Product } from "../api/schemas";

/**
 * Inventory status for storefront and merchant surfaces.
 *
 * Thresholds are derived from a product's `stock` and, when present, its
 * `minimumOrderQuantity` (MOQ). DummyJSON ships an `availabilityStatus` string
 * but its wording is inconsistent between records, so Meridian derives status
 * from the numeric fields instead and treats the remote string as display-only
 * metadata.
 *
 * Rules (deterministic, pure):
 *   - OUT  ("out-of-stock"):        stock <= 0
 *   - LOW  ("low-stock"):          0 < stock <= lowStockThreshold
 *   - IN   ("in-stock"):           stock > lowStockThreshold
 *
 * The low-stock threshold is `max(DEFAULT_LOW_STOCK_THRESHOLD, minimumOrderQuantity)`
 * so a product that can only be ordered in bulk (MOQ) does not report an
 * optimistic status when a single reorder would exhaust it.
 */

export type InventoryStatus = "out-of-stock" | "low-stock" | "in-stock";

/** Baseline unit count at or below which a product is considered low stock. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/** Minimal shape needed to classify inventory; MOQ is optional. */
export interface InventoryInput {
  stock: number;
  minimumOrderQuantity?: number;
}

/** Resolve the effective low-stock threshold: max(default, MOQ). */
export function lowStockThresholdFor(input: InventoryInput): number {
  const moq = Number.isFinite(input.minimumOrderQuantity)
    ? Math.max(0, Math.floor(input.minimumOrderQuantity as number))
    : 0;
  return Math.max(DEFAULT_LOW_STOCK_THRESHOLD, moq);
}

/** Coerce stock into a whole number; non-finite input is treated as 0. */
export function normalizeStock(stock: number): number {
  if (!Number.isFinite(stock)) return 0;
  return Math.max(0, Math.floor(stock));
}

/** Classify a product's inventory status. */
export function inventoryStatus(input: InventoryInput): InventoryStatus {
  const stock = normalizeStock(input.stock);
  if (stock <= 0) return "out-of-stock";
  if (stock <= lowStockThresholdFor(input)) return "low-stock";
  return "in-stock";
}

/** True when the product cannot currently be purchased. */
export function isOutOfStock(input: InventoryInput): boolean {
  return inventoryStatus(input) === "out-of-stock";
}

/** True when stock is positive but at or below the effective threshold. */
export function isLowStock(input: InventoryInput): boolean {
  return inventoryStatus(input) === "low-stock";
}

/** True when stock is comfortably above the effective threshold. */
export function isInStock(input: InventoryInput): boolean {
  return inventoryStatus(input) === "in-stock";
}

/**
 * Whether `quantity` units can be ordered by halves: the quantity must be a
 * positive whole number, a multiple of the MOQ, and available in stock.
 */
export function canOrderQuantity(input: InventoryInput, quantity: number): boolean {
  const requested = Number.isFinite(quantity) ? Math.floor(quantity) : 0;
  if (requested <= 0) return false;
  const moq = Number.isFinite(input.minimumOrderQuantity)
    ? Math.max(1, Math.floor(input.minimumOrderQuantity as number))
    : 1;
  if (requested % moq !== 0) return false;
  return requested <= normalizeStock(input.stock);
}

/** Maximum orderable units in MOQ increments, floored to the MOQ step. */
export function maxOrderableQuantity(input: InventoryInput): number {
  const stock = normalizeStock(input.stock);
  const moq = Number.isFinite(input.minimumOrderQuantity)
    ? Math.max(1, Math.floor(input.minimumOrderQuantity as number))
    : 1;
  return Math.floor(stock / moq) * moq;
}

/** Human-readable label for a status, suitable for badges and headings. */
export function inventoryStatusLabel(status: InventoryStatus): string {
  switch (status) {
    case "out-of-stock":
      return "Out of stock";
    case "low-stock":
      return "Low stock";
    default:
      return "In stock";
  }
}

/** Classify a full product record (uses `stock` and `minimumOrderQuantity`). */
export function productInventoryStatus(product: Pick<Product, "stock" | "minimumOrderQuantity">): InventoryStatus {
  return inventoryStatus({
    stock: product.stock,
    minimumOrderQuantity: product.minimumOrderQuantity,
  });
}
