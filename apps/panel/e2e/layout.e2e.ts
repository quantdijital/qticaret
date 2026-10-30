import { expect, pageHeading, test } from "./support/guard"
import { layoutIssues } from "./support/layout"
import { SECTIONS, SETTINGS } from "./support/screens"

// A page takes a few seconds on a CI runner: a test that walks many gets that much per page
const PER_PAGE_MS = 10_000
// The lists whose first record opens a detail page
const DETAILS = [
  "/orders",
  "/customers",
  "/products",
  "/promotions",
  "/promotions/price-lists",
  "/brands",
  "/content",
]

/**
 * Docs/18 §2 "Denge": on a desktop screen no page has cards side by side
 * that end on different lines, nor controls side by side of different
 * heights (support/layout.ts measures both). Read only.
 */
test("keeps every page's cards and controls level", async ({ page, guard }) => {
  const pages = [...SECTIONS, ...SETTINGS]
  test.setTimeout((pages.length + DETAILS.length * 2) * PER_PAGE_MS)
  await page.setViewportSize({ width: 1440, height: 900 })
  const found: Record<string, string[]> = {}
  const measure = async (path: string) => {
    await expect(pageHeading(page)).toBeVisible()
    await page.waitForLoadState("networkidle")
    // The finished page is measured: no card still drawn as its skeleton
    await expect(page.locator('main [data-slot="skeleton"], main [aria-busy="true"]')).toHaveCount(
      0
    )
    const issues = await layoutIssues(page)
    if (issues.length > 0) {
      found[path] = issues
    }
    await guard.assertHealthy()
  }
  for (const path of pages) {
    await test.step(path, async () => {
      await page.goto(path)
      await measure(path)
    })
  }
  for (const list of DETAILS) {
    await test.step(`${list} (first record)`, async () => {
      await page.goto(list)
      await page.waitForLoadState("networkidle")
      const link = page.locator("main table tbody tr a").first()
      // An empty shop has nothing to open here
      if ((await link.count()) === 0) {
        return
      }
      await link.click()
      await measure(page.url())
    })
  }
  expect(found).toEqual({})
})
