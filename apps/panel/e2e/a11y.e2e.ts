import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"
import { MODES, inMode } from "./support/theme"

/**
 * Screens a person spends the most time on; WCAG 2.1 A and AA rules (docs/06,
 * docs/18). The product wizard carries the stepper the dashboard's setup
 * card shows only to a shop not yet set up.
 */
const SCREENS = [
  "/",
  "/products",
  "/products/new",
  "/orders",
  "/promotions/price-lists",
  "/promotions/gift-cards",
  "/promotions/price-lists/new",
  "/settings/store",
  "/settings/payments",
  "/settings/payments/paytr",
  "/settings/payments/iyzico",
  "/settings/payments/bank_transfer",
  "/settings/payments/cash_on_delivery",
  "/orders/chargebacks",
  "/settings/integrations",
  "/settings/appearance",
  "/reports/products",
]

async function seriousIssues(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`
    )
}

for (const path of SCREENS) {
  test(`${path} has no serious accessibility issue, light or dark`, async ({ page }) => {
    for (const mode of MODES) {
      await test.step(mode, async () => {
        await inMode(page, mode)
        await page.goto(path)
        await expect(pageHeading(page)).toBeVisible()
        await page.waitForLoadState("networkidle")
        expect(await seriousIssues(page)).toEqual([])
        await page.unrouteAll({ behavior: "ignoreErrors" })
      })
    }
  })
}

test("an order's page has no serious accessibility issue", async ({ page }) => {
  await page.goto("/orders")
  await page.getByRole("table").getByRole("link").first().click()
  await expect(page).toHaveURL(/\/orders\/order_/)
  await expect(pageHeading(page)).toBeVisible()
  await page.waitForLoadState("networkidle")
  expect(await seriousIssues(page)).toEqual([])
})

test("a product's page has no serious accessibility issue", async ({ page }) => {
  await page.goto("/products")
  await page.getByRole("table").getByRole("link").first().click()
  await expect(pageHeading(page)).toBeVisible()
  // Its price history (F4.3) is read beside the product
  await page.locator("#product-price-history").scrollIntoViewIfNeeded()
  await page.waitForLoadState("networkidle")
  expect(await seriousIssues(page)).toEqual([])
})

test("bulk edit's bar and dialog have no serious accessibility issue", async ({ page }) => {
  await page.goto("/products")
  await page.getByRole("table").getByRole("checkbox").nth(1).check()
  await page.getByRole("button", { name: "Toplu düzenle" }).click()
  await page.getByRole("menuitem", { name: "Stoğu değiştir" }).click()
  await expect(page.getByRole("dialog", { name: "Stoğu değiştir" })).toBeVisible()
  expect(await seriousIssues(page)).toEqual([])
})
