import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { DEMO_PRODUCT, dismissCookies } from "./support"

// WCAG 2.2 AA: a serious or critical finding fails the page
const PAGES = [
  "/",
  DEMO_PRODUCT,
  "/sepet",
  "/magaza",
  "/yorumlar",
  "/siparis",
  "/hesap/giris",
  "/hesap/kayit",
  "/hesap/sifre-sifirla",
]

test.describe("accessibility", () => {
  for (const path of PAGES) {
    test(`${path} has no serious axe finding`, async ({ page }) => {
      await page.goto(path)
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
