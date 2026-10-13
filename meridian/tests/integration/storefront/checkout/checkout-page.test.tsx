import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the checkout route guard.
 *
 * The page owns the hydration-safe empty-cart redirect. The real store is used
 * so the guard sees the actual persisted lines, while `next/navigation`, the
 * hydration hook, and the wizard itself are reduced to lightweight stand-ins so
 * assertions target the guard rather than form internals.
 */

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
const hydration = vi.hoisted(() => ({ hydrated: false }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
}));

vi.mock("@/hooks/use-hydrated", () => ({
  useHydrated: () => hydration.hydrated,
}));

vi.mock("@/components/ui/skeleton", async () => {
  const React = await import("react");
  return {
    Skeleton: (props: { className?: string }) =>
      React.createElement("div", { "data-testid": "skeleton", ...props }),
  };
});

vi.mock("@/features/storefront/checkout/checkout-wizard", async () => {
  const React = await import("react");
  return {
    CheckoutWizard: ({
      onOrderPlaced,
    }: {
      onOrderPlaced?: (orderNumber: number) => void;
    }) =>
      React.createElement(
        "div",
        null,
        React.createElement("span", null, "checkout-wizard"),
        React.createElement(
          "button",
          { type: "button", onClick: () => onOrderPlaced?.(1) },
          "emit-order",
        ),
      ),
  };
});

import { CheckoutPage } from "@/app/(storefront)/checkout/page";
import type { CartLine } from "@/lib/domain/cart";
import { useCartStore } from "@/lib/state";

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 7,
    title: "Field Jacket",
    thumbnail: "https://cdn.dummyjson.com/product-images/1.webp",
    price: 120,
    discountPercentage: 0,
    quantity: 1,
    minimumOrderQuantity: 1,
    stock: 10,
    ...overrides,
  };
}

beforeEach(() => {
  hydration.hydrated = false;
  window.localStorage.clear();
  useCartStore.setState({ lines: [] });
  nav.replace.mockReset();
});

afterEach(() => {
  window.localStorage.clear();
  useCartStore.setState({ lines: [] });
  vi.clearAllMocks();
});

describe("CheckoutPage — empty-cart guard", () => {
  it("shows a neutral loading shell before hydration and never redirects", () => {
    hydration.hydrated = false;
    useCartStore.setState({ lines: [] });

    render(<CheckoutPage />);

    expect(screen.getByText("Loading checkout")).toBeInTheDocument();
    expect(screen.queryByText("checkout-wizard")).toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("does not render the wizard on the first paint even with lines present", () => {
    hydration.hydrated = false;
    useCartStore.setState({ lines: [makeLine()] });

    render(<CheckoutPage />);

    expect(screen.getByText("Loading checkout")).toBeInTheDocument();
    expect(screen.queryByText("checkout-wizard")).toBeNull();
  });

  it("redirects to /cart once hydrated with an empty cart", async () => {
    hydration.hydrated = true;
    useCartStore.setState({ lines: [] });

    render(<CheckoutPage />);

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/cart"));
    expect(screen.queryByText("checkout-wizard")).toBeNull();
  });

  it("renders the wizard and does not redirect with a non-empty cart", () => {
    hydration.hydrated = true;
    useCartStore.setState({ lines: [makeLine()] });

    render(<CheckoutPage />);

    expect(screen.getByText("checkout-wizard")).toBeInTheDocument();
    expect(screen.queryByText("Loading checkout")).toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});

describe("CheckoutPage — post-order guard suppression", () => {
  it("keeps the confirmation visible after the cart is emptied by placing an order", async () => {
    hydration.hydrated = true;
    useCartStore.setState({ lines: [makeLine()] });

    const user = userEvent.setup();
    render(<CheckoutPage />);

    await user.click(screen.getByRole("button", { name: "emit-order" }));
    useCartStore.setState({ lines: [] });

    await waitFor(() =>
      expect(screen.getByText("checkout-wizard")).toBeInTheDocument(),
    );
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
