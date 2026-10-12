"use client";

import { useState, type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * Rehydrates the persisted Zustand stores exactly once, on the client.
 *
 * Every store is created with `skipHydration`, so this is the single place that
 * applies `localStorage` state after mount. It renders nothing.
 */
function StoreHydrator(): null {
  useHydrated();
  return null;
}

/**
 * Root application providers, mounted once from `app/layout.tsx`.
 *
 * - A single {@link QueryClient} is created lazily with `useState`, so it stays
 *   stable across renders and Fast Refresh instead of being recreated.
 * - `next-themes` drives the `class` strategy with system detection.
 * - The shadcn `TooltipProvider` and the Sonner `Toaster` are available
 *   app-wide, including the storefront and the studio shells.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider delay={200}>
          <StoreHydrator />
          {children}
          <Toaster position="bottom-right" closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
