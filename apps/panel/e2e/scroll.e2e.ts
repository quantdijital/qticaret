import type { Page } from "@playwright/test"
import { expect, test } from "./support/guard"
import { scrollIssues } from "./support/scroll"
import { SESSION_FILE } from "./support/paths"
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

// Lists with tables whose borders and row outlines land on fractions of a pixel once zoomed
const ZOOMED = ["/orders", "/products", "/customers", "/settings/attributes", "/settings/audit"]
// A browser's zoom is a device pixel ratio grown by it and a viewport shrunk by it (a 1440×900
// window): 90%, 110%, 125%, 150% on a plain screen, and 100%, 110% on a Mac's retina (×2)
const ZOOMS = [
  { screen: 1, zoom: 0.9 },
  { screen: 1, zoom: 1.1 },
  { screen: 1, zoom: 1.25 },
  { screen: 1, zoom: 1.5 },
  { screen: 2, zoom: 1 },
  { screen: 2, zoom: 1.1 },
]
// On the retina at 100% the pages are measured again under CSS zoom on the root: fractional sizes
const CSS_ZOOMS = ["0.9", "1.1"]

/**
 * No one-pixel scrollbar at browser zoom or on a retina screen (the owner on
 * a Mac, 2026-11-24: every table scrolled up and down a pixel). A table that
 * scrolls sideways must shut its other axis (support/scroll.ts); this opens
 * the table pages at the densities and zooms where sub-pixel sizes appear.
 */
test("shows no stray scrollbar at browser zoom or on a retina screen", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(ZOOMED.length * (ZOOMS.length + CSS_ZOOMS.length) * PER_PAGE_MS)
  const found: Record<string, string[]> = {}
  for (const { screen, zoom } of ZOOMS) {
    const label = `screen ×${String(screen)} at ${String(Math.round(zoom * 100))}%`
    const context = await browser.newContext({
      ...(baseURL ? { baseURL } : {}),
      storageState: SESSION_FILE,
      locale: "tr-TR",
      timezoneId: "Europe/Istanbul",
      deviceScaleFactor: screen * zoom,
      viewport: { width: Math.round(1440 / zoom), height: Math.round(900 / zoom) },
    })
    const page = await context.newPage()
    try {
      for (const path of ZOOMED) {
        await test.step(`${path}, ${label}`, async () => {
          await page.goto(path)
          await expect(page.locator("main")).toBeVisible()
          await page.waitForLoadState("networkidle")
          const runs = screen === 2 && zoom === 1 ? ["1", ...CSS_ZOOMS] : ["1"]
          for (const css of runs) {
            await page.evaluate((value) => {
              document.documentElement.style.setProperty("zoom", value)
            }, css)
            await settle(page)
            for (const issue of await scrollIssues(page)) {
              ;(found[`${path}, ${label}, CSS zoom ${css}`] ??= []).push(issue)
            }
          }
        })
      }
    } finally {
      await context.close()
    }
  }
  expect(found).toEqual({})
})
