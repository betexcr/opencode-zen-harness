import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Phase 3 whole-surface release gate (task-16).
 *
 * This is the verification unit the task-16 release gate filters on. It encodes
 * the acceptance criteria that must hold once the storefront shopping flows
 * ship, without re-running the other suites here:
 *
 *   1. the four release-gate scripts exist and are wired,
 *   2. the Phase 3 storefront routes exist on disk,
 *   3. Studio remains an unchanged placeholder shell with no merchant mutation
 *      state or forms wired into it,
 *   4. no test in the suite is skipped, focused, or todo-ed (nothing weakened).
 */

const ROOT = process.cwd();

const RELEASE_GATE_SCRIPTS = ["typecheck", "lint", "test", "build"];

const PHASE_3_ROUTES = [
  "app/(storefront)/products/page.tsx",
  "app/(storefront)/products/[id]/page.tsx",
  "app/(storefront)/cart/page.tsx",
  "app/(storefront)/checkout/page.tsx",
];

function absolute(relative: string): string {
  return path.join(ROOT, relative);
}

function exists(relative: string): boolean {
  return existsSync(absolute(relative));
}

function read(relative: string): string {
  return readFileSync(absolute(relative), "utf8");
}

function listTestFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...listTestFiles(full));
    } else if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

describe("release gate: project scripts", () => {
  const scripts =
    (JSON.parse(read("package.json")) as { scripts?: Record<string, string> })
      .scripts ?? {};

  it("wires the four release-gate scripts as non-empty commands", () => {
    for (const name of RELEASE_GATE_SCRIPTS) {
      const command = scripts[name];
      expect(typeof command, `missing package.json script: ${name}`).toBe(
        "string",
      );
      expect(
        (command ?? "").trim().length,
        `empty package.json script: ${name}`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("release gate: Phase 3 storefront routes", () => {
  it("ships the catalog, product, cart, and checkout routes", () => {
    for (const route of PHASE_3_ROUTES) {
      expect(exists(route), `missing route module: ${route}`).toBe(true);
    }
  });
});

describe("release gate: Studio remains a placeholder shell", () => {
  it("keeps the studio route and layout on disk", () => {
    expect(exists("app/studio/layout.tsx")).toBe(true);
    expect(exists("app/studio/page.tsx")).toBe(true);
  });

  it("wires no merchant mutation state or forms into the studio shell", () => {
    const shell = `${read("app/studio/layout.tsx")}\n${read("app/studio/page.tsx")}`;
    expect(shell).not.toMatch(
      /created-products-store|overrides-store|merchandising-store/,
    );
    expect(shell).not.toMatch(/<form[\s>]/);
  });
});

describe("release gate: no test is weakened", () => {
  it("contains no skipped, focused, or todo-ed tests", () => {
    const files = listTestFiles(absolute("tests"));
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const relative = path.relative(ROOT, file).split(path.sep).join("/");
      if (
        /\b(?:it|test|describe)\.(?:skip|only|todo)\s*\(/.test(source) ||
        /\b(?:xit|xdescribe|xtest|fit|fdescribe)\s*\(/.test(source)
      ) {
        offenders.push(relative);
      }
    }
    expect(offenders, "tests must not be skipped, focused, or todo-ed").toEqual(
      [],
    );
  });
});
