import type { ReactNode } from "react";

import { StudioShell } from "@/components/studio-shell";

/**
 * Merchant workspace layout.
 *
 * All routes under `/studio` render inside {@link StudioShell}, which is
 * intentionally distinct from the storefront shell: a denser top bar, its own
 * navigation and a link back to the shop. This is a server component that
 * delegates interactivity to the client shell.
 */
export default function StudioLayout({ children }: { children: ReactNode }) {
  return <StudioShell>{children}</StudioShell>;
}
