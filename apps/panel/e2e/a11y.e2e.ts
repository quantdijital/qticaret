import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"
import { SECTIONS, SETTINGS } from "./support/screens"
import { MODES, inMode } from "./support/theme"

/**
 * Every screen a shop uses (support/screens.ts), light and dark; WCAG 2.1
 * A and AA rules (docs/06, docs/18 §9). The product wizard carries the
 * stepper the dashboard's setup card shows only to a shop not yet set up.
 */
const SCREENS = [...SECTIONS, ...SETTINGS, "/reset-password"]

async function seriousIssues(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // A message preview runs no script, axe's included (it would wait there forever);
    // what it shows is the shop's e-mail, not the panel
    .exclude('iframe[sandbox=""]')
    // The theme editor's preview is the storefront itself, checked by the storefront's own tests
    .exclude("iframe[data-storefront-preview]")
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

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  // Before sign-in the colours are the defaults, whose mode follows the system's
  for (const path of ["/login", "/reset-password", "/invite"]) {
    test(`${path} has no serious accessibility issue, light or dark`, async ({ page }) => {
      for (const mode of MODES) {
        await test.step(mode, async () => {
          await page.emulateMedia({ colorScheme: mode })
          await page.goto(path)
          await expect(pageHeading(page)).toBeVisible()
          await page.waitForLoadState("networkidle")
          expect(await seriousIssues(page)).toEqual([])
        })
      }
    })
  }
})

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
  await page.waitForLoadState("networkidle")
  expect(await seriousIssues(page)).toEqual([])
  // Its price history (F4.3) is a tab under the main cards (docs/06 "Detay sayfası düzeni")
  await page.getByRole("tab", { name: "Fiyat geçmişi" }).click()
  await page.locator("#product-price-history").scrollIntoViewIfNeeded()
  await page.waitForLoadState("networkidle")
  expect(await seriousIssues(page)).toEqual([])
})

test("a blog post's page, its parts folded and open, has no serious accessibility issue", async ({
  page,
}) => {
  await page.goto("/content?kind=post")
  await page.waitForLoadState("networkidle")
  const first = page.getByRole("table").getByRole("link").first()
  test.skip((await first.count()) === 0, "no blog post in this database")
  await first.click()
  await expect(pageHeading(page)).toBeVisible()
  await page.waitForLoadState("networkidle")
  expect(await seriousIssues(page)).toEqual([])
  // Its search appearance, summary, cover and filing fold under the text (docs/06 "Metin sayfaları")
  for (const part of await page.locator("main section > header button[aria-expanded]").all()) {
    if ((await part.getAttribute("aria-expanded")) === "false") {
      await part.click()
    }
    await expect(part).toHaveAttribute("aria-expanded", "true")
  }
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
