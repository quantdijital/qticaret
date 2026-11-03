import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"
import { SECTIONS, SETTINGS } from "./support/screens"
import { shellIssues } from "./support/shell"

// A page takes a few seconds on a CI runner: a test that walks many gets that much per page
const PER_PAGE_MS = 10_000
// A laptop, a desktop and a phone (docs/18 §9 draws down to 375 px; this is a common phone)
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]
// The lists whose first record opens a detail page
const DETAILS = [
  "/orders",
  "/customers",
  "/products",
  "/promotions",
  "/promotions/price-lists",
  "/brands",
  "/content",
  "/bulk-messages",
  "/payment-links",
]
// Signed out: the pages before the shell
const PUBLIC = ["/login", "/reset-password", "/invite"]

/** The page once it is drawn whole: its heading, its data, no card still a skeleton. */
async function settled(page: Page) {
  await expect(pageHeading(page)).toBeVisible()
  await page.waitForLoadState("networkidle")
  await expect(page.locator('main [data-slot="skeleton"], main [aria-busy="true"]')).toHaveCount(0)
}

/**
 * The owner, 2026-11-03: "ekranın alt kısmında gereksiz bir siyah boşluk".
 * Every page, at a laptop's, a desktop's and a phone's size, ends with its
 * own content on its own background: it does not scroll on into an empty
 * band, shows no strip of another colour under the content, and never
 * scrolls sideways (support/shell.ts). Read only. A detail page whose list
 * is empty in this shop is skipped, and the run says so.
 */
for (const size of SIZES) {
  test(`ends every page on its own background at ${String(size.width)}×${String(size.height)}`, async ({
    page,
    guard,
  }) => {
    const pages = [...SECTIONS, ...SETTINGS]
    test.setTimeout((pages.length + DETAILS.length * 2) * PER_PAGE_MS)
    await page.setViewportSize(size)
    const found: Record<string, string[]> = {}
    const measure = async (path: string) => {
      await settled(page)
      const issues = await shellIssues(page)
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
        // The list read whole first: an empty one is told from one still loading
        await settled(page)
        const link = page.locator("main table tbody tr a").first()
        if ((await link.count()) === 0) {
          test.info().annotations.push({
            type: "skip",
            description: `${list}: no record in this shop to open`,
          })
          return
        }
        await link.click()
        await page.waitForURL((url) => url.pathname !== list)
        await measure(new URL(page.url()).pathname)
      })
    }
    expect(found).toEqual({})
  })
}

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("ends the sign-in pages on their own background at every size", async ({ page, guard }) => {
    const found: Record<string, string[]> = {}
    for (const size of SIZES) {
      await page.setViewportSize(size)
      for (const path of PUBLIC) {
        await test.step(`${path} ${String(size.width)}`, async () => {
          await page.goto(path)
          await expect(pageHeading(page)).toBeVisible()
          await page.waitForLoadState("networkidle")
          const issues = await shellIssues(page)
          if (issues.length > 0) {
            found[`${path} ${String(size.width)}`] = issues
          }
          await guard.assertHealthy()
        })
      }
    }
    expect(found).toEqual({})
  })
})
