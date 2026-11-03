import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { pathOf, PRODUCT_PAGE, SEARCH_PAGE } from "./catalog"
import { dismissCookies } from "./support"

// WCAG 2.2 AA: a serious or critical finding fails the page
const PAGES = [
  "/",
  PRODUCT_PAGE,
  "/sepet",
  "/magaza",
  "/kategoriler",
  "/markalar",
  "/kampanyalar",
  "/arama?q=bicak",
  "/yorumlar",
  "/siparis",
  "/hesap/giris",
  "/hesap/kayit",
  "/hesap/sifre-sifirla",
  "/cerez-tercihleri",
  "/abonelik/cik?t=bozuk",
]

test.describe("accessibility", () => {
  for (const path of PAGES) {
    test(`${path} has no serious axe finding`, async ({ page }) => {
      await page.goto(await pathOf(path))
      await dismissCookies(page)
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      const serious = result.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical"
      )
      expect(serious.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([])
    })
  }
})

// Lighthouse's heading-order (axe best practice, moderate): a level is never skipped (docs/21)
const HEADED = [
  "/",
  PRODUCT_PAGE,
  "/magaza",
  "/kampanyalar",
  SEARCH_PAGE,
  "/arama?q=bicak",
  "/blog",
  "/kategoriler",
  "/markalar",
  "/yorumlar",
  "/sepet",
]

test.describe("heading order", () => {
  for (const path of HEADED) {
    test(`${path} skips no heading level`, async ({ page }) => {
      await page.goto(await pathOf(path))
      const result = await new AxeBuilder({ page }).withRules(["heading-order"]).analyze()
      expect(
        result.violations.flatMap((violation) => violation.nodes.map((node) => node.html))
      ).toEqual([])
    })
  }
})
