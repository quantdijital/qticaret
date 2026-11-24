import type { Page } from "@playwright/test"
import { expect, test } from "./support/guard"
import { scrollIssues } from "./support/scroll"
import { SECTIONS, SETTINGS } from "./support/screens"

// A page takes a few seconds on a CI runner, its five widths a second more
const PER_PAGE_MS = 12_000
// Docs/18 §9 and the owner's checklist: phone, tablet, small laptop, laptop, desktop
const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
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
  "/collections",
  "/content",
]

/** Two frames: the layout a resize starts has been drawn. */
const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      })
  )

/**
 * No stray scrollbar on any page at any width (the owner, 2026-11-24): the
 * page never scrolls sideways, and nothing inside it shows a scrollbar
 * unless it is a scroll area by design (`data-scroll-area`, support/scroll.ts).
 * Each page is opened once and measured at every width. Read only.
 */
test("shows no stray scrollbar on any page at any width", async ({ page, guard }) => {
  const pages = [...SECTIONS, ...SETTINGS]
  test.setTimeout((pages.length + DETAILS.length * 2) * PER_PAGE_MS)
  const found: Record<string, string[]> = {}
  const measure = async (path: string) => {
    // A page a feature flag closes has no heading of its own, only why it is closed
    await expect(page.locator("main")).toBeVisible()
    await page.waitForLoadState("networkidle")
    await expect(page.locator('main [data-slot="skeleton"], main [aria-busy="true"]')).toHaveCount(
      0
    )
    for (const size of WIDTHS) {
      await page.setViewportSize(size)
      await settle(page)
      let issues = await scrollIssues(page)
      if (issues.length > 0) {
        // A card that redraws for the new width (a chart, a phone list) is measured once it has
        await page.waitForTimeout(500)
        issues = await scrollIssues(page)
      }
      for (const issue of issues) {
        ;(found[path] ??= []).push(`${String(size.width)}: ${issue}`)
      }
    }
    await guard.assertHealthy()
  }
  for (const path of pages) {
    await test.step(path, async () => {
      await page.setViewportSize(WIDTHS[0] ?? { width: 1440, height: 900 })
      await page.goto(path)
      await measure(path)
    })
  }
  for (const list of DETAILS) {
    await test.step(`${list} (first record)`, async () => {
      await page.setViewportSize(WIDTHS[0] ?? { width: 1440, height: 900 })
      await page.goto(list)
      await page.waitForLoadState("networkidle")
      const link = page.locator("main table tbody tr a").first()
      // An empty shop has nothing to open here
      if ((await link.count()) === 0) {
        return
      }
      await link.click()
      await measure(new URL(page.url()).pathname)
    })
  }
  expect(found).toEqual({})
})
