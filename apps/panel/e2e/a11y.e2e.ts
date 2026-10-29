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
  "/customers/groups",
  "/reviews",
  "/reviews/questions",
  "/promotions/price-lists",
  "/promotions/gift-cards",
  "/promotions/price-lists/new",
  "/settings",
  "/settings/store",
  "/settings/payments",
  "/settings/payments/paytr",
  "/settings/payments/iyzico",
  "/settings/payments/bank_transfer",
  "/settings/payments/cash_on_delivery",
  "/settings/shipping",
  "/settings/shipping/geliver",
  "/settings/shipping/aras",
  "/settings/shipping/yurtici",
  "/settings/notifications",
  "/settings/sms",
  "/settings/sms/netgsm",
  "/orders/chargebacks",
  "/orders/returns",
  "/settings/integrations",
  "/settings/appearance",
  "/reports/products",
  "/reports/finance",
  "/reports/stock",
  "/reports/search",
  "/settings/accounting",
  "/settings/api",
]

async function seriousIssues(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // A message preview runs no script, axe's included (it would wait there forever);
    // what it shows is the shop's e-mail, not the panel
    .exclude('iframe[sandbox=""]')
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

test("an order's edit dialog has no serious accessibility issue", async ({ page }) => {
  // An order still to ship can be edited (adr/0033), unless its parcel is packed with a label
  await page.goto("/orders?stage=to_ship")
  await page.waitForLoadState("networkidle")
  const first = page
    .getByRole("table")
    .getByRole("row")
    .filter({ hasNotText: "Etiket hazır" })
    .getByRole("link")
    .first()
  test.skip((await first.count()) === 0, "no order waiting to ship in this database")
  await first.click()
  await expect(pageHeading(page)).toBeVisible()
  await page.getByRole("button", { name: "Diğer işlemler" }).click()
  await page.getByRole("menuitem", { name: "Siparişi düzenle" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  expect(await seriousIssues(page)).toEqual([])
})
