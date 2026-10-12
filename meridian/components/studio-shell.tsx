"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MenuIcon, StoreIcon } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Studio navigation targets. Every entry resolves to a real route. */
const STUDIO_NAV = [{ href: "/studio", label: "Overview" }] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(active: boolean): string {
  return cn(
    "meridian-focus rounded-md px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-muted text-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

/**
 * Merchant shell used by every `/studio` route.
 *
 * Distinct from the storefront shell: a compact top bar carrying the studio
 * identity, a persistent navigation rail, a link back to the shop, and the
 * shared theme toggle. It collapses to a sheet-based menu below `md` so the
 * workspace stays usable on narrow screens.
 */
export function StudioShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface-sunken">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex h-16 w-full max-w-[var(--container-editorial)] items-center gap-2 px-4 sm:gap-4 sm:px-6">
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  aria-label="Open studio navigation"
                />
              }
            >
              <MenuIcon aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader className="border-b border-border">
                <SheetTitle>Meridian Studio</SheetTitle>
                <SheetDescription className="sr-only">
                  Merchant workspace navigation
                </SheetDescription>
              </SheetHeader>
              <nav aria-label="Studio" className="flex flex-col gap-1 px-2">
                {STUDIO_NAV.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <SheetClose
                      key={item.href}
                      render={
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={navLinkClass(active)}
                        />
                      }
                    >
                      {item.label}
                    </SheetClose>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          <Link
            href="/studio"
            className="meridian-focus flex items-center gap-2 rounded-sm"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-background">
              M
            </span>
            <span className="font-heading text-base font-semibold tracking-tight">
              Studio
            </span>
          </Link>

          <nav
            aria-label="Studio"
            className="ml-4 hidden items-center gap-1 md:flex"
          >
            {STUDIO_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={navLinkClass(active)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="meridian-focus hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              <StoreIcon className="size-4" aria-hidden="true" />
              Shop
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="studio-content"
        className="mx-auto flex w-full max-w-[var(--container-editorial)] flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14"
      >
        {children}
      </main>
    </div>
  );
}
