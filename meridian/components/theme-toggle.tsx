"use client";

import { useSyncExternalStore } from "react";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Module-level no-op subscription.
 *
 * Stable across renders, so `useSyncExternalStore` never re-subscribes. The
 * store never changes; this is used purely to obtain a client-only snapshot.
 */
const subscribe = () => () => {};

/**
 * Reports whether the component has mounted on the client.
 *
 * `useSyncExternalStore` returns `getServerSnapshot` (`false`) during SSR and
 * the hydration pass, then `getSnapshot` (`true`) on the client. This keeps the
 * server and first client render identical without calling `setState` inside an
 * effect, which the `react-hooks/set-state-in-effect` rule forbids.
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * Light/dark theme toggle.
 *
 * Uses `next-themes` so the choice persists and follows the OS preference until
 * the visitor overrides it. The rendered icon is gated on the mounted flag so
 * the server and the first client render agree (no hydration mismatch), then
 * resolves to the live theme.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = mounted && resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = mounted
    ? `Switch to ${nextTheme} theme`
    : "Toggle color theme";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={() => setTheme(nextTheme)}
          />
        }
      >
        {isDark ? (
          <SunIcon aria-hidden="true" />
        ) : (
          <MoonIcon aria-hidden="true" />
        )}
      </TooltipTrigger>
      <TooltipContent>
        {mounted ? (isDark ? "Light theme" : "Dark theme") : "Color theme"}
      </TooltipContent>
    </Tooltip>
  );
}
