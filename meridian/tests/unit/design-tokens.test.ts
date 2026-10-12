import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const globalsCssPath = join(process.cwd(), "app/globals.css");
const globalsCss = readFileSync(globalsCssPath, "utf-8");

describe("Design tokens & theme — globals.css", () => {
  it("defines @theme inline mapping for all Meridian surface tokens", () => {
    const surfaceTokens = [
      "--color-surface: var(--surface);",
      "--color-surface-foreground: var(--surface-foreground);",
      "--color-surface-muted: var(--surface-muted);",
      "--color-surface-sunken: var(--surface-sunken);",
      "--color-surface-raised: var(--surface-raised);",
    ];
    for (const token of surfaceTokens) {
      expect(globalsCss).toContain(token);
    }
  });

  it("defines @theme inline mapping for Meridian accent brand tokens", () => {
    const accentTokens = [
      "--color-accent-brand: var(--accent-brand);",
      "--color-accent-brand-foreground: var(--accent-brand-foreground);",
      "--color-accent-brand-muted: var(--accent-brand-muted);",
      "--color-accent-brand-muted-foreground: var(--accent-brand-muted-foreground);",
    ];
    for (const token of accentTokens) {
      expect(globalsCss).toContain(token);
    }
  });

  it("defines @theme inline mapping for semantic state tokens", () => {
    const semanticStates = [
      "success",
      "warning",
      "info",
    ];
    for (const state of semanticStates) {
      expect(globalsCss).toContain(`--color-${state}: var(--${state});`);
      expect(globalsCss).toContain(`--color-${state}-foreground: var(--${state}-foreground);`);
      expect(globalsCss).toContain(`--color-${state}-muted: var(--${state}-muted);`);
      expect(globalsCss).toContain(`--color-${state}-muted-foreground: var(--${state}-muted-foreground);`);
    }
  });

  it("defines editorial radii scale in @theme inline", () => {
    const radii = [
      "--radius-sm: calc(var(--radius) * 0.6);",
      "--radius-md: calc(var(--radius) * 0.8);",
      "--radius-lg: var(--radius);",
      "--radius-xl: calc(var(--radius) * 1.4);",
      "--radius-2xl: calc(var(--radius) * 1.8);",
      "--radius-3xl: calc(var(--radius) * 2.2);",
      "--radius-4xl: calc(var(--radius) * 2.6);",
      "--radius-pill: 999rem;",
    ];
    for (const radius of radii) {
      expect(globalsCss).toContain(radius);
    }
  });

  it("defines motion duration and easing tokens in @theme inline", () => {
    // Tokens may map to literal values or to shared --motion-* primitives
    // defined at :root; both forms must keep the same documented values.
    const motionTokens = [
      "--duration-fast",
      "--duration-base",
      "--duration-slow",
      "--ease-emphasis",
    ];
    for (const token of motionTokens) {
      expect(globalsCss).toMatch(
        new RegExp(
          `${token}:\\s*(\\d+ms|var\\(--motion-[a-z-]+\\)|cubic-bezier\\([^;]+\\));`,
        ),
      );
    }
    const motionValues = [
      "120ms",
      "200ms",
      "320ms",
      "cubic-bezier(0.22, 1, 0.36, 1)",
    ];
    for (const value of motionValues) {
      expect(globalsCss).toContain(value);
    }
  });

  it("defines restrained shadow tokens in @theme inline", () => {
    const shadowTokens = [
      "--shadow-card: 0 1px 2px oklch(0.145 0 0 / 0.05);",
      "--shadow-raised: 0 4px 12px oklch(0.145 0 0 / 0.08);",
      "--shadow-popover: 0 12px 32px oklch(0.145 0 0 / 0.12);",
    ];
    for (const token of shadowTokens) {
      expect(globalsCss).toContain(token);
    }
  });

  it("maps font tokens to distinct next/font variables without self-reference", () => {
    expect(globalsCss).toContain("--font-sans: var(--font-geist-sans);");
    expect(globalsCss).toContain("--font-mono: var(--font-geist-mono);");
    expect(globalsCss).toContain("--font-display: var(--font-fraunces);");
    expect(globalsCss).toContain("--font-heading: var(--font-fraunces);");
    expect(globalsCss).not.toContain("--font-sans: var(--font-sans);");
    expect(globalsCss).not.toContain("--font-heading: var(--font-sans);");
  });

  it("defines editorial type scale, spacing rhythm, and breakpoint tokens", () => {
    const typeScale = [
      "--text-overline: 0.6875rem;",
      "--text-display-sm: 2.25rem;",
      "--text-display-md: 3rem;",
      "--text-display-lg: 3.75rem;",
    ];
    for (const token of typeScale) {
      expect(globalsCss).toContain(token);
    }
    const rhythm = [
      "--spacing-gutter: 1.25rem;",
      "--spacing-section: 4rem;",
      "--spacing-section-lg: 6rem;",
      "--container-editorial: 72rem;",
      "--breakpoint-xs: 26rem;",
      "--breakpoint-3xl: 100rem;",
    ];
    for (const token of rhythm) {
      expect(globalsCss).toContain(token);
    }
  });

  it("has light mode (:root) Meridian palette with warm neutrals and clay accent", () => {
    const lightTokens = [
      "--surface: oklch(0.985 0.006 85);",
      "--surface-muted: oklch(0.965 0.009 85);",
      "--surface-sunken: oklch(0.95 0.011 85);",
      "--surface-raised: oklch(0.995 0.004 85);",
      "--accent-brand: oklch(0.58 0.1 45);",
      "--accent-brand-foreground: oklch(0.99 0.008 85);",
      "--accent-brand-muted: oklch(0.93 0.021 45);",
      "--accent-brand-muted-foreground: oklch(0.42 0.07 45);",
      "--success: oklch(0.52 0.1 155);",
      "--warning: oklch(0.72 0.14 75);",
      "--info: oklch(0.55 0.11 250);",
    ];
    for (const token of lightTokens) {
      expect(globalsCss).toContain(token);
    }
  });

  it("has dark mode (.dark) Meridian palette with warm charcoal surfaces", () => {
    const darkTokens = [
      "--surface: oklch(0.185 0.008 85);",
      "--surface-muted: oklch(0.24 0.009 85);",
      "--surface-sunken: oklch(0.15 0.008 85);",
      "--surface-raised: oklch(0.22 0.009 85);",
      "--accent-brand: oklch(0.72 0.095 50);",
      "--accent-brand-foreground: oklch(0.2 0.02 50);",
      "--accent-brand-muted: oklch(0.3 0.035 50);",
      "--accent-brand-muted-foreground: oklch(0.85 0.05 50);",
      "--success: oklch(0.66 0.11 155);",
      "--warning: oklch(0.78 0.13 80);",
      "--info: oklch(0.66 0.1 250);",
    ];
    for (const token of darkTokens) {
      expect(globalsCss).toContain(token);
    }
  });

  it("preserves all original shadcn token mappings in @theme inline", () => {
    const shadcnTokens = [
      "--color-background: var(--background);",
      "--color-foreground: var(--foreground);",
      "--color-card: var(--card);",
      "--color-card-foreground: var(--card-foreground);",
      "--color-popover: var(--popover);",
      "--color-popover-foreground: var(--popover-foreground);",
      "--color-primary: var(--primary);",
      "--color-primary-foreground: var(--primary-foreground);",
      "--color-secondary: var(--secondary);",
      "--color-secondary-foreground: var(--secondary-foreground);",
      "--color-muted: var(--muted);",
      "--color-muted-foreground: var(--muted-foreground);",
      "--color-accent: var(--accent);",
      "--color-accent-foreground: var(--accent-foreground);",
      "--color-destructive: var(--destructive);",
      "--color-border: var(--border);",
      "--color-input: var(--input);",
      "--color-ring: var(--ring);",
    ];
    for (const token of shadcnTokens) {
      expect(globalsCss).toContain(token);
    }
  });

  it("includes prefers-reduced-motion media query disabling animations", () => {
    expect(globalsCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalsCss).toContain("animation-duration: 0.01ms !important");
    expect(globalsCss).toContain("transition-duration: 0.01ms !important");
  });

  it("includes base layer with focus-visible and selection styles", () => {
    expect(globalsCss).toContain(":focus-visible");
    expect(globalsCss).toContain("ring-2 ring-ring/70 outline-none");
    expect(globalsCss).toContain("::selection");
    expect(globalsCss).toContain("var(--accent-brand-muted)");
  });

  it("includes component layer utilities for meridian classes", () => {
    expect(globalsCss).toContain(".meridian-overline");
    expect(globalsCss).toContain(".meridian-rule");
    expect(globalsCss).toContain(".meridian-focus");
    expect(globalsCss).toContain(".meridian-motion");
    expect(globalsCss).toContain(".meridian-skeleton");
    expect(globalsCss).toContain(".meridian-no-scrollbar");
  });
});

const layoutTsxPath = join(process.cwd(), "app/layout.tsx");
const layoutTsx = readFileSync(layoutTsxPath, "utf-8");

describe("Root layout — app/layout.tsx", () => {
  it("imports Fraunces as display font via next/font/google", () => {
    expect(layoutTsx).toContain("import { Fraunces");
    expect(layoutTsx).toContain("from \"next/font/google\"");
  });

  it("configures Fraunces with display variable and serif fallback", () => {
    expect(layoutTsx).toContain("variable: \"--font-fraunces\"");
    expect(layoutTsx).toContain("fallback: [\"Georgia\", \"Times New Roman\", \"serif\"]");
  });

  it("configures Geist Sans with --font-geist-sans variable", () => {
    expect(layoutTsx).toContain("variable: \"--font-geist-sans\"");
    expect(layoutTsx).toContain("Geist({");
  });

  it("configures Geist Mono with --font-geist-mono variable", () => {
    expect(layoutTsx).toContain("variable: \"--font-geist-mono\"");
    expect(layoutTsx).toContain("Geist_Mono({");
  });

  it("joins all font variables into single className string", () => {
    expect(layoutTsx).toContain("fontVariables");
    expect(layoutTsx).toContain(".join(\" \")");
  });

  it("applies font variables and antialiased to html element", () => {
    const htmlClassMatch = layoutTsx.match(/<html[^>]*className=\{`([^`]*)`\}/);
    expect(htmlClassMatch).not.toBeNull();
    const htmlClasses = (htmlClassMatch?.[1] ?? "").split(/\s+/);
    expect(htmlClasses).toContain("${fontVariables}");
    expect(htmlClasses).toContain("h-full");
    expect(htmlClasses).toContain("antialiased");
  });

  it("sets body with flex-col layout and background/foreground tokens", () => {
    const bodyClassMatch = layoutTsx.match(/<body className="([^"]+)"/);
    expect(bodyClassMatch).not.toBeNull();
    const bodyClasses = (bodyClassMatch?.[1] ?? "").split(/\s+/);
    for (const token of [
      "min-h-full",
      "flex",
      "flex-col",
      "bg-background",
      "font-sans",
      "text-foreground",
    ]) {
      expect(bodyClasses).toContain(token);
    }
  });

  it("includes metadata with Meridian branding", () => {
    expect(layoutTsx).toContain("Meridian — Editorial Commerce OS");
    expect(layoutTsx).toContain("template: \"%s · Meridian\"");
  });

  it("uses LayoutProps generic for type safety", () => {
    expect(layoutTsx).toContain("LayoutProps<\"/\">");
  });
});

describe("shadcn primitive compatibility", () => {
  it("button component uses shadcn token names that are preserved", () => {
    const buttonPath = join(process.cwd(), "components/ui/button.tsx");
    const buttonContent = readFileSync(buttonPath, "utf-8");
    // Verify button uses preserved token names
    expect(buttonContent).toContain("bg-primary");
    expect(buttonContent).toContain("text-primary-foreground");
    expect(buttonContent).toContain("bg-secondary");
    expect(buttonContent).toContain("text-secondary-foreground");
    expect(buttonContent).toContain("bg-destructive");
    expect(buttonContent).toContain("text-destructive");
    expect(buttonContent).toContain("border-border");
    expect(buttonContent).toContain("bg-background");
    expect(buttonContent).toContain("hover:bg-muted");
    expect(buttonContent).toContain("hover:text-foreground");
    expect(buttonContent).toContain("focus-visible:ring-ring");
  });

  it("skeleton component uses preserved muted token", () => {
    const skeletonPath = join(process.cwd(), "components/ui/skeleton.tsx");
    const skeletonContent = readFileSync(skeletonPath, "utf-8");
    expect(skeletonContent).toContain("bg-muted");
  });
});