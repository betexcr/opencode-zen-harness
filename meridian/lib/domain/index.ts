/**
 * Meridian Commerce OS domain layer — barrel export.
 *
 * Every module here is pure: no React, no I/O, no `fetch`. Business math and
 * product reconciliation live exclusively in this folder so that both the
 * storefront and the merchant studio share one source of truth.
 *
 * - `money`     integer-cent strategy, rounding, formatting
 * - `pricing`   discount / discounted-price math (DummyJSON contract)
 * - `cart`      line and cart totals plus DEMO shipping/tax estimates
 * - `inventory` stock status thresholds and orderability
 * - `product`   remote-vs-local override/reconciliation strategy
 */

export * from "./money";
export * from "./pricing";
export * from "./cart";
export * from "./inventory";
export * from "./product";
