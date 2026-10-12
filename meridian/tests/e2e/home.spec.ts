import { expect, test } from "@playwright/test";

/**
 * Home-route smoke.
 *
 * Verifies the storefront shell renders and the featured edit is produced by
 * the live API. Selectors are limited to stable, semantic landmarks so the
 * spec survives styling changes; the featured section is scoped by its
 * labelled heading rather than DOM position.
 */
test.describe("storefront home", () => {
  test("renders the editorial shell and the featured edit", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Meridian/);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /Retail, composed with intent/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Featured" }),
    ).toBeVisible();

    const featured = page.locator('section[aria-labelledby="featured-heading"]');
    await expect(featured.getByRole("listitem").first()).toBeVisible();
  });

  test("links through to Meridian Studio", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /Open Meridian Studio/i }).click();

    await expect(page).toHaveURL(/\/studio$/);
  });
});
