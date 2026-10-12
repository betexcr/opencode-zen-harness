"use client";

import Link from "next/link";

import {
  MenuIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  cartDiscountedTotalCents,
  lineTotalCents,
  type CartLine,
} from "@/lib/domain/cart";
import { formatCurrency } from "@/lib/domain/money";
import {
  selectCartItemCount,
  selectCartLines,
  useCartStore,
} from "@/lib/state";

/** Every header link resolves to a real route. */
const NAV_ITEMS = [
  { href: "/", label: "Shop" },
  { href: "/studio", label: "Studio" },
] as const;

function CartLineRow({ line }: { line: CartLine }) {
  const incrementLine = useCartStore((state) => state.incrementLine);
  const decrementLine = useCartStore((state) => state.decrementLine);
  const removeLine = useCartStore((state) => state.removeLine);

  return (
    <li className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {line.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatCurrency(lineTotalCents({ ...line, quantity: 1 }))} each
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label={`Decrease quantity of ${line.title}`}
            disabled={line.quantity <= 1}
            onClick={() => decrementLine(line.productId)}
          >
            <MinusIcon aria-hidden="true" />
          </Button>
          <span
            className="min-w-6 text-center text-sm tabular-nums"
            aria-live="polite"
          >
            {line.quantity}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label={`Increase quantity of ${line.title}`}
            onClick={() => incrementLine(line.productId)}
          >
            <PlusIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-sm font-medium tabular-nums">
          {formatCurrency(lineTotalCents(line))}
        </span>
        <button
          type="button"
          onClick={() => removeLine(line.productId)}
          className="meridian-focus rounded-sm text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

function CartButton({ hydrated }: { hydrated: boolean }) {
  const lines = useCartStore(selectCartLines);
  const itemCount = useCartStore(selectCartItemCount);
  const clear = useCartStore((state) => state.clear);
  const total = cartDiscountedTotalCents(lines);

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={
              hydrated && itemCount > 0
                ? `Open cart, ${itemCount} items`
                : "Open cart"
            }
          />
        }
      >
        <ShoppingBagIcon aria-hidden="true" />
        {hydrated && itemCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-brand px-1 text-[0.625rem] font-semibold tabular-nums text-accent-brand-foreground">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        ) : null}
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>
            {hydrated
              ? itemCount > 0
                ? `${itemCount} item${itemCount === 1 ? "" : "s"} saved in this browser.`
                : "Nothing saved yet."
              : "Loading your saved cart…"}
          </SheetDescription>
        </SheetHeader>

        {hydrated && lines.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <ul className="meridian-no-scrollbar flex-1 divide-y divide-border overflow-y-auto px-4">
              {lines.map((line) => (
                <CartLineRow key={line.productId} line={line} />
              ))}
            </ul>
            <SheetFooter className="border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(total)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Shipping and tax are estimated during checkout. This cart lives
                only in your browser.
              </p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => clear()}
              >
                Clear cart
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBagIcon
              className="size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              {hydrated
                ? "Your cart is empty. Browse the shop to add something."
                : "Loading your cart…"}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function SiteHeader() {
  const hydrated = useHydrated();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 w-full max-w-[var(--container-editorial)] items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Sheet>
          <SheetTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Open navigation menu"
              />
            }
          >
            <MenuIcon aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader className="border-b border-border">
              <SheetTitle>Meridian</SheetTitle>
              <SheetDescription className="sr-only">
                Browse the storefront
              </SheetDescription>
            </SheetHeader>
            <nav aria-label="Mobile" className="flex flex-col gap-1 px-2">
              {NAV_ITEMS.map((item) => (
                <SheetClose
                  key={item.href}
                  render={
                    <Link
                      href={item.href}
                      className="meridian-focus rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    />
                  }
                >
                  {item.label}
                </SheetClose>
              ))}
            </nav>
            <SheetFooter>
              <p className="text-xs text-muted-foreground">
                Editorial retail, built on Next.js.
              </p>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Link
          href="/"
          className="meridian-focus rounded-sm font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          Meridian
        </Link>

        <nav
          aria-label="Primary"
          className="ml-6 hidden items-center gap-1 lg:flex"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="meridian-focus rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <CartButton hydrated={hydrated} />
        </div>
      </div>
    </header>
  );
}
