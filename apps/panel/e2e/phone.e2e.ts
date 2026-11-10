import { expect, pageHeading, test } from "./support/guard"
import { SECTIONS, SETTINGS } from "./support/screens"

// A page takes a few seconds on a CI runner: a test that walks many gets that much per page
const PER_PAGE_MS = 10_000
// Docs/18 §9: the narrowest phone the panel is drawn for
const PHONE = { width: 375, height: 812 }

// The lists whose first record opens a detail page
const DETAILS = [
  "/orders",
  "/customers",
  "/products",
  "/promotions",
  "/brands",
  "/collections",
  "/content",
]

/** Every screen fits a phone: nothing wider than the screen, so the page never scrolls sideways. */
test("fits every page on a phone", async ({ page, guard }) => {
  const pages = [...SECTIONS, ...SETTINGS]
  test.setTimeout((pages.length + DETAILS.length * 2) * PER_PAGE_MS)
  await page.setViewportSize(PHONE)
  const wide: Record<string, number> = {}
  const measure = async (path: string) => {
    await expect(pageHeading(page)).toBeVisible()
    await page.waitForLoadState("networkidle")
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    if (width > PHONE.width) {
      wide[path] = width
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
  expect(wide).toEqual({})
})
