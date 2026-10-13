import { expect, test, type Page } from "@playwright/test";

/**
 * Storefront happy-path smoke.
 *
 * Walks the primary shopper journey against the running app: open the
 * catalogue, apply a search, open a product detail, add the product to the
 * cart, and confirm the cart shows the added line and a total. Selectors are
 * limited to stable, semantic landmarks (roles, accessible names, headings) so
 * the spec survives styling changes, matching the style of
 * `tests/e2e/home.spec.ts`.
 *
 * The catalogue and product data are produced by the live sample API, so the
 * spec asserts structure rather than exact money strings: the product's own
 * title (read from the detail heading) is asserted as a cart line, and the
 * order summary is asserted to expose a currency total. Product id 1 is
 * pre-rendered by `generateStaticParams`, so the detail route resolves without
 * a cold fetch.
 */

/** A product id covered by the catalogue's `generateStaticParams` pre-render. */
const PRODUCT_ID = 1;

/**
 * Assert the product detail page is ready and return its title. The heading is
 * rendered by `ProductInfo` from the same product the cart snapshots, so the
 * cart can be asserted against it without hard-coding catalogue content.
 */
async function expectProductTitle(page: Page): Promise<string> {
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  const title = (await heading.textContent())?.trim() ?? "";
  expect(title.length).toBeGreaterThan(0);
  return title;
}

test.describe("storefront smoke", () => {
  test("catalog -> product -> add to cart -> cart shows the line and total", async ({
    page,
  }) => {
    // This journey compiles several routes against the running Next dev server,
    // so it runs well past the default 30s per-test budget; mark it slow.
    test.slow();

    await page.goto("/products");

    await expect(
      page.getByRole("heading", { level: 1, name: /Browse the catalogue/i }),
    ).toBeVisible();

    const search = page.getByRole("search");
    await search
      .getByRole("searchbox", { name: "Search products" })
      .fill("phone");
    await search.getByRole("button", { name: "Search" }).click();

    await expect(page).toHaveURL(/[?&]q=phone/);

    await page.goto(`/products/${PRODUCT_ID}`);
    const title = await expectProductTitle(page);

    await page.getByRole("button", { name: "Add to cart" }).click();

    await page.goto("/cart");

    await expect(
      page.getByRole("heading", { level: 1, name: /Shopping cart/i }),
    ).toBeVisible();

    const cart = page.getByRole("table", { name: "Items in your cart" });
    await expect(cart).toBeVisible();
    await expect(cart.getByText(title, { exact: true })).toBeVisible();

    const summary = page.getByRole("complementary", {
      name: "Order summary",
    });
    await expect(summary).toBeVisible();
    await expect(summary.getByText("Total", { exact: true })).toBeVisible();
    await expect(summary.locator("dd").last()).toHaveText(/^\$\d/);
  });
});
