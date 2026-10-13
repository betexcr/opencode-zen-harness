import type { ComponentPropsWithoutRef, ReactElement, ReactNode, Ref } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the persistent cart drawer.
 *
 * The drawer is composition + persisted state: it reads the cart through the
 * shared selectors and mutates it through `cartActions`. To keep the test
 * focused on that behavior (and out of base-ui's portal/animation internals,
 * which jsdom does not reproduce), the sheet primitive is reduced to a
 * pass-through that renders its trigger and content inline — the same approach
 * the app shell tests use. The hydration gate is stubbed so both the
 * first-paint (not hydrated) and hydrated renders can be asserted.
 */

const state = vi.hoisted(() => ({ hydrated: true }));

vi.mock("@/components/ui/button", async () => {
  const React = await import("react");
  const Button = React.forwardRef(function Button(
    props: ComponentPropsWithoutRef<"button">,
    ref: Ref<HTMLButtonElement>,
  ) {
    return React.createElement("button", { ref, type: "button", ...props });
  });
  return { Button, buttonVariants: () => "" };
});

vi.mock("@/components/ui/sheet", async () => {
  const React = await import("react");
  const withRender = (
    tag: "button" | "div",
    props: { render?: ReactElement; children?: ReactNode },
  ) =>
    props.render
      ? React.cloneElement(props.render, {}, props.children)
      : React.createElement(tag, null, props.children);
  return {
    Sheet: (props: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, props.children),
    SheetTrigger: (props: { render?: ReactElement; children?: ReactNode }) =>
      withRender("button", props),
    SheetContent: (props: { children?: ReactNode }) =>
      React.createElement("div", { "data-testid": "sheet-content" }, props.children),
    SheetHeader: (props: { children?: ReactNode }) =>
      React.createElement("div", null, props.children),
    SheetTitle: (props: { children?: ReactNode }) =>
      React.createElement("h2", null, props.children),
    SheetDescription: (props: { children?: ReactNode }) =>
      React.createElement("p", null, props.children),
    SheetFooter: (props: { children?: ReactNode }) =>
      React.createElement("div", null, props.children),
  };
});

vi.mock("@/hooks/use-hydrated", () => ({
  useHydrated: () => state.hydrated,
}));

import { CartDrawer } from "@/features/storefront/cart/cart-drawer";
import type { CartLine } from "@/lib/domain/cart";
import { useCartStore } from "@/lib/state";

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 1,
    title: "Aurora Lamp",
    thumbnail: "https://cdn.dummyjson.com/product-images/1.webp",
    price: 25,
    discountPercentage: 0,
    quantity: 2,
    minimumOrderQuantity: 1,
    stock: 10,
    ...overrides,
  };
}

describe("CartDrawer", () => {
  beforeEach(() => {
    state.hydrated = true;
    window.localStorage.clear();
    useCartStore.setState({ lines: [] });
  });

  afterEach(() => {
    window.localStorage.clear();
    useCartStore.setState({ lines: [] });
    vi.clearAllMocks();
  });

  it("renders no persisted count during the first paint (hydration-safe)", () => {
    state.hydrated = false;
    useCartStore.setState({ lines: [makeLine()] });

    render(<CartDrawer />);

    expect(
      screen.getByRole("button", { name: "Open cart" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open cart, \d+ items/ })).toBeNull();
    expect(screen.getByText("Loading your saved cart…")).toBeInTheDocument();
  });

  it("shows the item-count badge once hydrated", () => {
    state.hydrated = true;
    useCartStore.setState({ lines: [makeLine({ quantity: 3 })] });

    render(<CartDrawer />);

    const trigger = screen.getByRole("button", { name: "Open cart, 3 items" });
    expect(trigger).toBeInTheDocument();
    expect(within(trigger).getByText("3")).toBeInTheDocument();
  });

  it("lists current lines with money formatting and DEMO totals", () => {
    state.hydrated = true;
    useCartStore.setState({ lines: [makeLine({ price: 25, quantity: 2 })] });

    render(<CartDrawer />);

    expect(screen.getByText("Aurora Lamp")).toBeInTheDocument();
    expect(screen.getByText("$25.00 each")).toBeInTheDocument();
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("Estimated total")).toBeInTheDocument();
  });

  it("shows the empty state when the cart has no lines", () => {
    state.hydrated = true;

    render(<CartDrawer />);

    expect(
      screen.getByText("Your cart is empty. Browse the shop to add something."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Subtotal")).toBeNull();
  });

  it("clears the cart from the drawer footer", async () => {
    state.hydrated = true;
    useCartStore.setState({ lines: [makeLine()] });

    render(<CartDrawer />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Clear cart" }));

    expect(useCartStore.getState().lines).toHaveLength(0);
  });
});
