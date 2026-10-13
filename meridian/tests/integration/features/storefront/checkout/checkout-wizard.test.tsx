import type {
  ComponentPropsWithoutRef,
  ReactNode,
  Ref,
} from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The wizard drives a multi-step form through jsdom and runs in the same
// worker pool as dozens of other suites; give each case generous headroom so
// the gate is not load-flaky.
vi.setConfig({ testTimeout: 20000 });

/**
 * Integration tests for the multi-step checkout wizard.
 *
 * The base-ui-backed primitives (button, label, input, separator) and
 * `next/link` are reduced to plain DOM stand-ins so the assertions cover the
 * wizard's behavior — step gating, recap, order persistence, cart clearing, and
 * the demo confirmation — rather than portal/rendering internals. The real
 * `lib/validation/checkout.ts` schemas and the persisted stores are used
 * unchanged.
 */

vi.mock("@/components/ui/button", async () => {
  const React = await import("react");
  const Button = React.forwardRef(function Button(
    props: ComponentPropsWithoutRef<"button">,
    ref: Ref<HTMLButtonElement>,
  ) {
    return React.createElement("button", { ref, ...props });
  });
  return { Button, buttonVariants: () => "" };
});

vi.mock("@/components/ui/input", async () => {
  const React = await import("react");
  const Input = React.forwardRef(function Input(
    props: ComponentPropsWithoutRef<"input">,
    ref: Ref<HTMLInputElement>,
  ) {
    return React.createElement("input", { ref, ...props });
  });
  return { Input };
});

vi.mock("@/components/ui/label", async () => {
  const React = await import("react");
  const Label = React.forwardRef(function Label(
    props: ComponentPropsWithoutRef<"label">,
    ref: Ref<HTMLLabelElement>,
  ) {
    return React.createElement("label", { ref, ...props });
  });
  return { Label };
});

vi.mock("@/components/ui/separator", async () => {
  const React = await import("react");
  return { Separator: () => React.createElement("hr") };
});

vi.mock("next/link", async () => {
  const React = await import("react");
  const Link = React.forwardRef(function Link(
    props: { href?: unknown; children?: ReactNode; className?: string },
    ref: Ref<HTMLAnchorElement>,
  ) {
    return React.createElement(
      "a",
      {
        ref,
        href: typeof props.href === "string" ? props.href : "#",
        className: props.className,
      },
      props.children,
    );
  });
  return { default: Link };
});

import { CheckoutWizard } from "@/features/storefront/checkout/checkout-wizard";
import type { CartLine } from "@/lib/domain/cart";
import { useCartStore, useOrdersStore } from "@/lib/state";

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

async function fillContact(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), "Jane Doe");
  await user.type(screen.getByLabelText("Email"), "jane@example.com");
  await user.type(screen.getByLabelText("Phone"), "+1 555 123 4567");
}

async function fillShipping(user: ReturnType<typeof userEvent.setup>) {
  const recipient = screen.getByLabelText("Recipient name");
  await user.clear(recipient);
  await user.type(recipient, "Jane Doe");
  await user.type(screen.getByLabelText("Street address"), "10 Market Street");
  await user.type(screen.getByLabelText("City"), "Springfield");
  await user.type(screen.getByLabelText("State or region"), "Illinois");
  await user.type(screen.getByLabelText("Postal code"), "62704");
  await user.type(screen.getByLabelText("Country"), "United States");
}

async function fillPayment(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name on card"), "Jane Doe");
  await user.type(screen.getByLabelText("Card number"), "4242 4242 4242 4242");
  await user.type(screen.getByLabelText("Expiry"), "12/34");
  await user.type(screen.getByLabelText("CVC"), "123");
}

async function advance(
  user: ReturnType<typeof userEvent.setup>,
  expectedHeading: string,
) {
  await user.click(screen.getByRole("button", { name: /continue/i }));
  expect(
    await screen.findByRole("heading", { name: expectedHeading, level: 2 }),
  ).toBeInTheDocument();
}

async function completeToReview(user: ReturnType<typeof userEvent.setup>) {
  await fillContact(user);
  await advance(user, "Shipping");
  await fillShipping(user);
  await advance(user, "Payment");
  await fillPayment(user);
  await advance(user, "Review");
}

beforeEach(() => {
  window.localStorage.clear();
  useCartStore.setState({ lines: [] });
  useOrdersStore.setState({ orders: [] });
});

afterEach(() => {
  window.localStorage.clear();
  useCartStore.setState({ lines: [] });
  useOrdersStore.setState({ orders: [] });
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("CheckoutWizard — step gating", () => {
  it("opens on the contact step with its fields", () => {
    useCartStore.setState({ lines: [makeLine()] });
    render(<CheckoutWizard />);

    expect(
      screen.getByRole("heading", { name: "Contact", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
  });

  it("blocks advancing when the current step is invalid", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ lines: [makeLine()] });
    render(<CheckoutWizard />);

    await user.click(screen.getByRole("button", { name: /continue/i }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Contact", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Street address")).toBeNull();
  });

  it("validates only the current step's fields before advancing", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ lines: [makeLine()] });
    render(<CheckoutWizard />);

    await fillContact(user);
    await advance(user, "Shipping");

    expect(screen.getByLabelText("Recipient name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Full name")).toBeNull();
  });

  it("steps back to a previous step without losing entered values", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ lines: [makeLine()] });
    render(<CheckoutWizard />);

    await fillContact(user);
    await advance(user, "Shipping");
    await user.click(screen.getByRole("button", { name: /^back$/i }));

    expect(
      await screen.findByRole("heading", { name: "Contact", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Jane Doe");
  });
});

describe("CheckoutWizard — review recap", () => {
  it("recaps the contact, shipping, and payment details", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ lines: [makeLine()] });
    render(<CheckoutWizard />);

    await completeToReview(user);

    expect(
      screen.getByRole("heading", { name: "Contact", level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("10 Market Street")).toBeInTheDocument();
    expect(screen.getByText("Springfield, Illinois")).toBeInTheDocument();
    expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0);
  });

  it("never renders the raw card number in the recap", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ lines: [makeLine()] });
    render(<CheckoutWizard />);

    await completeToReview(user);

    expect(screen.queryByText("4242 4242 4242 4242")).not.toBeInTheDocument();
    expect(screen.getByText(/4242$/)).toBeInTheDocument();
  });
});

describe("CheckoutWizard — placing a demo order", () => {
  it("persists a snapshot order, clears the cart, and shows the confirmation", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ lines: [makeLine({ quantity: 2 })] });
    const onOrderPlaced = vi.fn();
    render(<CheckoutWizard onOrderPlaced={onOrderPlaced} />);

    await completeToReview(user);
    await user.click(
      screen.getByRole("button", { name: /place demo order/i }),
    );

    expect(await screen.findByText("Order placed")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();

    const orders = useOrdersStore.getState().orders;
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ number: 1, status: "placed" });
    expect(orders[0].lines).toHaveLength(1);
    expect(orders[0].lines[0]).toMatchObject({ productId: 7, quantity: 2 });
    expect(typeof orders[0].placedAt).toBe("string");

    expect(useCartStore.getState().lines).toHaveLength(0);
    expect(onOrderPlaced).toHaveBeenCalledWith(1);
  });

  it("makes no network call to any payment provider", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    useCartStore.setState({ lines: [makeLine()] });
    render(<CheckoutWizard />);

    await completeToReview(user);
    await user.click(
      screen.getByRole("button", { name: /place demo order/i }),
    );
    await waitFor(() =>
      expect(screen.getByText("Order placed")).toBeInTheDocument(),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
