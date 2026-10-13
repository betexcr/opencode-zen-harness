import type { ComponentPropsWithoutRef, ReactElement, ReactNode, Ref } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the cart surface mounted inside the site header.
 *
 * The header owns the always-available cart sheet and its hydration-safe count
 * badge. The sheet primitive and theme toggle are reduced to lightweight
 * stand-ins so the assertions cover cart behavior — the badge, the listed
 * lines, the steppers, and removal — rather than base-ui's portal internals.
 */

const state = vi.hoisted(() => ({ hydrated: true }));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

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
    tag: "button" | "span",
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
    SheetClose: (props: { render?: ReactElement; children?: ReactNode }) =>
      withRender("span", props),
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

vi.mock("next/link", async () => {
  const React = await import("react");
  const Link = React.forwardRef(function Link(
    props: { href?: unknown; children?: ReactNode; className?: string },
    ref: Ref<HTMLAnchorElement>,
  ) {
    return React.createElement(
      "a",
      { ref, href: typeof props.href === "string" ? props.href : "#", className: props.className },
      props.children,
    );
  });
  return { default: Link };
});

vi.mock("@/hooks/use-hydrated", () => ({
  useHydrated: () => state.hydrated,
}));

import { SiteHeader } from "@/components/site-header";
import type { CartLine } from "@/lib/domain/cart";
import { useCartStore } from "@/lib/state";

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 1,
    title: "Field Jacket",
    thumbnail: "https://cdn.dummyjson.com/product-images/1.webp",
    price: 120,
    discountPercentage: 0,
    quantity: 3,
    minimumOrderQuantity: 1,
    stock: 10,
    ...overrides,
  };
}

describe("SiteHeader cart", () => {
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

    render(<SiteHeader />);

    expect(screen.getByRole("button", { name: "Open cart" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open cart, \d+ items/ })).toBeNull();
  });

  it("shows the count badge once hydrated and lists the lines", () => {
    state.hydrated = true;
    useCartStore.setState({ lines: [makeLine({ quantity: 3 })] });

    render(<SiteHeader />);

    expect(
      screen.getByRole("button", { name: "Open cart, 3 items" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Field Jacket")).toBeInTheDocument();
    expect(screen.getByText("$120.00 each")).toBeInTheDocument();
  });

  it("updates quantities through the store steppers", async () => {
    state.hydrated = true;
    useCartStore.setState({ lines: [makeLine({ quantity: 2 })] });

    render(<SiteHeader />);

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /increase quantity of field jacket/i }),
    );

    expect(useCartStore.getState().lines[0]?.quantity).toBe(3);
  });

  it("removes a line from the header cart", async () => {
    state.hydrated = true;
    useCartStore.setState({ lines: [makeLine()] });

    render(<SiteHeader />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(useCartStore.getState().lines).toHaveLength(0);
  });
});
