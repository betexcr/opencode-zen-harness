import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  cartDiscount,
  cartDiscountedTotal,
  cartItemCount,
  cartLineCount,
  cartSubtotal,
  estimateOrderTotals,
  normalizeQuantity,
  type CartLine,
  type OrderEstimate,
} from "@/lib/domain/cart";
import {
  createSafePersistStorage,
  STORAGE_KEYS,
  STORAGE_VERSION,
} from "./persistence";

/**
 * Cart client state for Meridian Commerce OS.
 *
 * This store owns the user's LOCAL cart only. It holds {@link CartLine} values
 * (identity + captured display fields + quantity) and never ingests remote
 * DummyJSON cart sample data as if the shopper had created it. All money math is
 * delegated to `lib/domain/cart`; actions are pure reducers of state.
 *
 * Persistence is hydration-safe (`skipHydration: true`) and failure-tolerant;
 * the cart survives refresh and degrades to in-memory state if storage fails.
 */
export interface CartState {
  /** Ordered list of cart lines, most recently added last. */
  lines: CartLine[];
  /**
   * Add a line, or merge into an existing line with the same `productId`.
   * Non-positive quantities are ignored. `line.quantity` is replaced by
   * `quantity` (default 1) for new lines and summed for existing lines.
   */
  addLine: (line: CartLine, quantity?: number) => void;
  /** Set an absolute quantity; quantities <= 0 remove the line. */
  setQuantity: (productId: number, quantity: number) => void;
  /** Increase a line quantity by `by` (default 1); ignores missing lines. */
  incrementLine: (productId: number, by?: number) => void;
  /** Decrease a line quantity by `by` (default 1); removes at <= 0. */
  decrementLine: (productId: number, by?: number) => void;
  /** Remove a line entirely. */
  removeLine: (productId: number) => void;
  /** Remove every line. */
  clear: () => void;
}

function updateQuantity(
  lines: readonly CartLine[],
  productId: number,
  nextQuantity: number,
): CartLine[] {
  const quantity = normalizeQuantity(nextQuantity);
  if (quantity <= 0) {
    return lines.filter((line) => line.productId !== productId);
  }
  return lines.map((line) =>
    line.productId === productId ? { ...line, quantity } : line,
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      addLine: (line, quantity = 1) =>
        set((state) => {
          const amount = normalizeQuantity(quantity);
          if (amount <= 0) return state;
          const index = state.lines.findIndex(
            (existing) => existing.productId === line.productId,
          );
          if (index === -1) {
            return { lines: [...state.lines, { ...line, quantity: amount }] };
          }
          const next = state.lines.slice();
          next[index] = {
            ...next[index],
            ...line,
            quantity: normalizeQuantity(next[index].quantity + amount),
          };
          return { lines: next };
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          lines: updateQuantity(state.lines, productId, quantity),
        })),
      incrementLine: (productId, by = 1) =>
        set((state) => {
          const row = state.lines.find((line) => line.productId === productId);
          if (!row) return state;
          return {
            lines: updateQuantity(
              state.lines,
              productId,
              row.quantity + normalizeQuantity(by),
            ),
          };
        }),
      decrementLine: (productId, by = 1) =>
        set((state) => {
          const row = state.lines.find((line) => line.productId === productId);
          if (!row) return state;
          return {
            lines: updateQuantity(
              state.lines,
              productId,
              row.quantity - normalizeQuantity(by),
            ),
          };
        }),
      removeLine: (productId) =>
        set((state) => ({
          lines: state.lines.filter((line) => line.productId !== productId),
        })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: STORAGE_KEYS.cart,
      version: STORAGE_VERSION,
      storage: createSafePersistStorage<CartState>(),
      skipHydration: true,
    },
  ),
);

/* ------------------------------- selectors -------------------------------- */

export const selectCartLines = (state: CartState): CartLine[] => state.lines;

export const selectCartLineCount = (state: CartState): number =>
  cartLineCount(state.lines);

export const selectCartItemCount = (state: CartState): number =>
  cartItemCount(state.lines);

export const selectCartSubtotal = (state: CartState): number =>
  cartSubtotal(state.lines);

export const selectCartDiscount = (state: CartState): number =>
  cartDiscount(state.lines);

export const selectCartDiscountedTotal = (state: CartState): number =>
  cartDiscountedTotal(state.lines);

export const selectCartEstimate = (state: CartState): OrderEstimate =>
  estimateOrderTotals(state.lines);

export const selectCartQuantity =
  (productId: number) =>
  (state: CartState): number =>
    state.lines.find((line) => line.productId === productId)?.quantity ?? 0;
