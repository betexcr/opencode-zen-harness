import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkoutActions,
  placeCheckoutOrder,
  type CheckoutPlacementSurface,
} from "@/features/storefront/checkout/checkout-actions";
import {
  createOrderSnapshot,
  type CreateOrderInput,
} from "@/features/storefront/checkout/create-order";
import {
  estimateOrderTotals,
  type CartLine,
  type OrderEstimate,
} from "@/lib/domain/cart";
import {
  selectCartLines,
  selectOrderByNumber,
  selectOrderCount,
  useCartStore,
  useOrdersStore,
  STORAGE_KEYS,
  STORAGE_VERSION,
} from "@/lib/state";
import type { CheckoutValues } from "@/lib/validation/checkout";

/**
 * Unit tests for the pure checkout order builder
 * (`features/storefront/checkout/create-order.ts`) and the checkout ->
 * orders-store persistence path (`features/storefront/checkout/checkout-actions.ts`).
 */

const PLACED_AT = "2026-02-14T09:30:00.000Z";

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 1,
    title: "Essence Mascara Lash Princess",
    thumbnail: "essence.webp",
    price: 10,
    discountPercentage: 0,
    quantity: 2,
    ...overrides,
  };
}

function makeValues(overrides: Partial<CheckoutValues> = {}): CheckoutValues {
  return {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+1 (555) 010-2030",
    line1: "12 Analytical Engine Way",
    line2: "Suite 7",
    city: "London",
    region: "Greater London",
    postalCode: "EC1A 1BB",
    country: "United Kingdom",
    cardName: "Ada Lovelace",
    cardNumber: "4242 4242 4242 4242",
    expiry: "04/29",
    cvc: "123",
    ...overrides,
  };
}

function makeInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    lines: [makeLine()],
    values: makeValues(),
    placedAt: PLACED_AT,
    ...overrides,
  };
}

/** Two discounted lines producing a non-trivial deterministic estimate. */
function pricedLines(): CartLine[] {
  return [
    makeLine({ productId: 1, price: 10, discountPercentage: 0, quantity: 2 }),
    makeLine({
      productId: 2,
      title: "Eyeshadow Palette",
      thumbnail: "palette.webp",
      price: 24.5,
      discountPercentage: 10,
      quantity: 1,
    }),
  ];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createOrderSnapshot", () => {
  it("snapshots the cart lines without aliasing mutable input", () => {
    const inputLines = pricedLines();
    const snapshot = createOrderSnapshot({
      lines: inputLines,
      values: makeValues(),
      placedAt: PLACED_AT,
    });

    expect(snapshot.lines).toEqual(inputLines);
    expect(snapshot.lines[0]).not.toBe(inputLines[0]);
    expect(snapshot.lines[1]).not.toBe(inputLines[1]);

    inputLines[0].quantity = 99;
    expect(snapshot.lines[0].quantity).toBe(2);
  });

  it("copies optional product fields only when present", () => {
    const bare = makeLine({ productId: 5 });
    const detailed = makeLine({
      productId: 6,
      minimumOrderQuantity: 3,
      stock: 12,
    });

    const snapshot = createOrderSnapshot({
      lines: [bare, detailed],
      values: makeValues(),
      placedAt: PLACED_AT,
    });

    expect("minimumOrderQuantity" in snapshot.lines[0]).toBe(false);
    expect("stock" in snapshot.lines[0]).toBe(false);
    expect(snapshot.lines[1].minimumOrderQuantity).toBe(3);
    expect(snapshot.lines[1].stock).toBe(12);
  });

  it("derives the estimate from the lines via estimateOrderTotals", () => {
    const lines = pricedLines();
    const snapshot = createOrderSnapshot({
      lines,
      values: makeValues(),
      placedAt: PLACED_AT,
    });

    expect(snapshot.estimate).toEqual(estimateOrderTotals(lines));
    expect(snapshot.estimate).toEqual({
      subtotalCents: 4450,
      discountCents: 245,
      discountedSubtotalCents: 4205,
      shippingCents: 599,
      taxCents: 294,
      totalCents: 5098,
      taxRatePercent: 7,
      itemCount: 3,
    });
  });

  it("sets status 'placed' and forwards the caller timestamp", () => {
    const snapshot = createOrderSnapshot(makeInput());

    expect(snapshot.status).toBe("placed");
    expect(snapshot.placedAt).toBe(PLACED_AT);
  });

  it("summarizes contact/shipping and never retains the full card", () => {
    const snapshot = createOrderSnapshot({
      lines: [makeLine()],
      values: makeValues({
        fullName: "Grace Hopper",
        line2: undefined,
        cardNumber: "4242 4242 4242 4242",
      }),
      placedAt: PLACED_AT,
    });

    expect(snapshot.contact).toEqual({
      fullName: "Grace Hopper",
      email: "ada@example.com",
      phone: "+1 (555) 010-2030",
    });
    expect(snapshot.shipping).toEqual({
      fullName: "Grace Hopper",
      line1: "12 Analytical Engine Way",
      line2: "",
      city: "London",
      region: "Greater London",
      postalCode: "EC1A 1BB",
      country: "United Kingdom",
    });
    expect(snapshot.payment).toEqual({
      cardName: "Ada Lovelace",
      cardLast4: "4242",
      expiry: "04/29",
      demo: true,
    });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("4242 4242 4242 4242");
    expect(serialized).not.toContain("4242424242424242");
    expect(serialized).not.toContain("cvc");
  });
});

describe("placeCheckoutOrder (pure)", () => {
  it("no-ops for an empty cart without touching the stores", () => {
    const placeOrder = vi.fn(() => 1);
    const clearCart = vi.fn();

    const result = placeCheckoutOrder(
      { placeOrder, clearCart },
      makeInput({ lines: [] }),
    );

    expect(result).toBeNull();
    expect(placeOrder).not.toHaveBeenCalled();
    expect(clearCart).not.toHaveBeenCalled();
  });

  it("persists the built snapshot before clearing the cart", () => {
    const calls: string[] = [];
    const lines = pricedLines();
    let captured: {
      lines: readonly CartLine[];
      estimate: OrderEstimate;
      placedAt: string;
    } | null = null;

    const surface: CheckoutPlacementSurface = {
      placeOrder: (placedLines, estimate, placedAt) => {
        calls.push("placeOrder");
        captured = { lines: placedLines, estimate, placedAt };
        return 11;
      },
      clearCart: () => {
        calls.push("clearCart");
      },
    };

    const input = makeInput({ lines });
    const result = placeCheckoutOrder(surface, input);

    expect(calls).toEqual(["placeOrder", "clearCart"]);
    expect(result?.number).toBe(11);
    expect(result?.snapshot).toEqual(createOrderSnapshot(input));

    expect(captured).not.toBeNull();
    expect(captured!.placedAt).toBe(PLACED_AT);
    expect(captured!.estimate).toEqual(estimateOrderTotals(lines));
    expect(captured!.lines).toEqual(result?.snapshot.lines);
    expect(captured!.lines).not.toBe(lines);
  });
});

describe("checkoutActions (bound to persisted stores)", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [] });
    useOrdersStore.setState({ orders: [] });
    window.localStorage.clear();
  });

  it("persists exactly one order, then clears the cart", () => {
    const lines = pricedLines();
    useCartStore.setState({ lines });

    const placed = checkoutActions.placeOrder({
      lines: useCartStore.getState().lines,
      values: makeValues(),
      placedAt: PLACED_AT,
    });

    expect(placed).not.toBeNull();
    expect(placed?.number).toBe(1);
    expect(selectOrderCount(useOrdersStore.getState())).toBe(1);
    expect(selectCartLines(useCartStore.getState())).toEqual([]);

    const order = selectOrderByNumber(1)(useOrdersStore.getState());
    expect(order?.status).toBe("placed");
    expect(order?.placedAt).toBe(PLACED_AT);
    expect(order?.lines).toEqual(lines);
    expect(order?.estimate.totalCents).toBe(estimateOrderTotals(lines).totalCents);

    const raw = window.localStorage.getItem(STORAGE_KEYS.orders);
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string) as {
      version: number;
      state: { orders: unknown[] };
    };
    expect(persisted.version).toBe(STORAGE_VERSION);
    expect(persisted.state.orders).toHaveLength(1);
  });

  it("is a no-op when the cart is empty", () => {
    const placed = checkoutActions.placeOrder({
      lines: [],
      values: makeValues(),
      placedAt: PLACED_AT,
    });

    expect(placed).toBeNull();
    expect(selectOrderCount(useOrdersStore.getState())).toBe(0);
    expect(selectCartLines(useCartStore.getState())).toEqual([]);
    expect(window.localStorage.getItem(STORAGE_KEYS.orders)).toBeNull();
  });

  it("keeps a placed order immutable against later mutation", () => {
    const lines = [makeLine({ productId: 1, quantity: 2 })];
    const placed = checkoutActions.placeOrder({
      lines,
      values: makeValues(),
      placedAt: PLACED_AT,
    });
    expect(placed).not.toBeNull();

    const order = selectOrderByNumber(1)(useOrdersStore.getState());
    const frozenTotal = order?.estimate.totalCents;
    expect(frozenTotal).toBe(estimateOrderTotals(lines).totalCents);

    lines[0].quantity = 99;
    if (placed) {
      placed.snapshot.lines[0].quantity = 99;
      placed.snapshot.estimate.totalCents = 1;
    }

    expect(order?.lines[0].quantity).toBe(2);
    expect(order?.estimate.totalCents).toBe(frozenTotal);
  });
});
