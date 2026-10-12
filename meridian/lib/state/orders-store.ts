import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, OrderEstimate } from "@/lib/domain/cart";
import {
  createSafePersistStorage,
  STORAGE_KEYS,
  STORAGE_VERSION,
} from "./persistence";

/**
 * Demo order history for Meridian Commerce OS.
 *
 * DummyJSON has no durable order backend, so a Meridian "order" is LOCAL,
 * simulated application state: a snapshot of the cart lines plus the demo
 * estimate computed at checkout time. It is never presented as server-side
 * persistence, but it does survive refresh.
 *
 * The snapshot is copied on creation so later cart edits cannot mutate a placed
 * order. Every action is a pure reducer of state (timestamps and estimates are
 * supplied by the caller); persistence is hydration-safe (`skipHydration`) and
 * failure-tolerant.
 */

export type OrderStatus = "placed" | "fulfilled" | "cancelled";

export interface DemoOrder {
  /** Monotonic local order number (1-based). */
  number: number;
  /** ISO timestamp captured at placement (caller-supplied for purity). */
  placedAt: string;
  /** Immutable snapshot of the cart lines at placement. */
  lines: CartLine[];
  /** Demo estimate frozen at placement time. */
  estimate: OrderEstimate;
  /** Local order status. */
  status: OrderStatus;
}

export interface OrdersState {
  /** Placed demo orders, most recent last. */
  orders: DemoOrder[];
  /**
   * Place an order from a cart snapshot and its estimate; returns the assigned
   * order number. Copies the inputs so the order is immutable thereafter.
   */
  placeOrder: (lines: readonly CartLine[], estimate: OrderEstimate, placedAt: string) => number;
  /** Update a demo order's status (no-op for unknown order numbers). */
  setStatus: (number: number, status: OrderStatus) => void;
  /** Remove a single demo order. */
  remove: (number: number) => void;
  /** Remove every demo order. */
  clear: () => void;
}

type OrdersPersistedState = Pick<OrdersState, "orders">;

/** Copy a cart line so a placed order never aliases mutable cart state. */
function cloneLine(line: CartLine): CartLine {
  return {
    productId: line.productId,
    title: line.title,
    thumbnail: line.thumbnail,
    price: line.price,
    discountPercentage: line.discountPercentage,
    quantity: line.quantity,
  };
}

/** Copy a demo estimate into a new object. */
function cloneEstimate(estimate: OrderEstimate): OrderEstimate {
  return { ...estimate };
}

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set) => ({
      orders: [],
      placeOrder: (lines, estimate, placedAt) => {
        let assigned = 0;
        set((state) => {
          const number =
            state.orders.reduce((max, order) => Math.max(max, order.number), 0) + 1;
          assigned = number;
          const order: DemoOrder = {
            number,
            placedAt,
            lines: lines.map(cloneLine),
            estimate: cloneEstimate(estimate),
            status: "placed",
          };
          return { orders: [...state.orders, order] };
        });
        return assigned;
      },
      setStatus: (number, status) =>
        set((state) => ({
          orders: state.orders.map((order) =>
            order.number === number ? { ...order, status } : order,
          ),
        })),
      remove: (number) =>
        set((state) => ({
          orders: state.orders.filter((order) => order.number !== number),
        })),
      clear: () => set({ orders: [] }),
    }),
    {
      name: STORAGE_KEYS.orders,
      version: STORAGE_VERSION,
      storage: createSafePersistStorage<OrdersPersistedState>(),
      partialize: (state) => ({ orders: state.orders }),
      skipHydration: true,
    },
  ),
);

/* ------------------------------- selectors -------------------------------- */

export const selectOrders = (state: OrdersState): DemoOrder[] => state.orders;

export const selectOrderCount = (state: OrdersState): number =>
  state.orders.length;

export const selectOrderByNumber =
  (number: number) =>
  (state: OrdersState): DemoOrder | undefined =>
    state.orders.find((order) => order.number === number);

export const selectLatestOrder = (state: OrdersState): DemoOrder | undefined =>
  state.orders.length > 0 ? state.orders[state.orders.length - 1] : undefined;

export const selectOrdersTotalCents = (state: OrdersState): number =>
  state.orders.reduce((total, order) => total + order.estimate.totalCents, 0);
