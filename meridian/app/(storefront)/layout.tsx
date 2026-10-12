import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * Storefront shell.
 *
 * Every route inside the `(storefront)` group is composed with the persistent
 * storefront header and footer. The group exists so the merchant workspace
 * under `/studio` can use its own shell without inheriting the shop chrome.
 * The layout is a server component; the header manages its own client
 * interactivity (cart sheet, theme toggle, mobile navigation).
 */
export default function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main id="storefront-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
