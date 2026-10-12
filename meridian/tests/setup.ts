import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Vitest runs without the global test API, so Testing Library cannot register
 * its own automatic cleanup. Without this, DOM rendered by one test leaks into
 * the next test in the same file and queries like `getByText` start finding
 * multiple elements. Register cleanup explicitly after every test.
 */
afterEach(() => {
  cleanup();
});
