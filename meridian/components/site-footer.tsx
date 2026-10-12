import Link from "next/link";

import { CopyrightYear } from "@/components/copyright-year";

/** Footer links all resolve to real routes. */
const FOOTER_LINKS = [
  { href: "/", label: "Shop" },
  { href: "/studio", label: "Studio" },
] as const;

const EXTERNAL_LINKS = [
  { href: "https://dummyjson.com", label: "DummyJSON API" },
] as const;

export function SiteFooter() {

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-[var(--container-editorial)] flex-col gap-10 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-3">
          <Link
            href="/"
            className="meridian-focus inline-flex items-center gap-2 rounded-md"
            aria-label="Meridian home"
          >
            <span className="flex size-8 items-center justify-center rounded-md bg-foreground text-sm font-semibold text-background">
              M
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">
              Meridian
            </span>
          </Link>
          <p className="text-pretty text-sm text-muted-foreground">
            An editorial retail foundation for storefront and merchant studio
            experiences.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-3">
          <h2 className="meridian-overline">Browse</h2>
          <ul className="flex flex-col gap-2">
            {FOOTER_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="meridian-focus rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-3">
          <h2 className="meridian-overline">Data</h2>
          <p className="max-w-xs text-pretty text-sm text-muted-foreground">
            Product, user, and cart data is provided by a public sample API and
            is not production content.
          </p>
          <ul className="flex flex-col gap-2">
            {EXTERNAL_LINKS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="meridian-focus w-fit rounded-sm text-sm font-medium text-foreground underline underline-offset-4 transition-colors hover:text-accent-brand"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[var(--container-editorial)] flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © <CopyrightYear /> Meridian. Demo project — not a real store.
          </p>
          <p>Built with Next.js and sample catalogue data.</p>
        </div>
      </div>
    </footer>
  );
}
