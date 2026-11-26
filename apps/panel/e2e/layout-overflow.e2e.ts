import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

// A phone and a small laptop: where headers and toolbars ran out of room (2026-11-26 audit)
const WIDTHS = [
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
]
// The main lists: their header, toolbar and table
const LISTS = [
  "/orders",
  "/products",
  "/customers",
  "/categories",
  "/brands",
  "/promotions",
  "/content",
  "/inventory",
  "/media",
  "/reports",
]
// Lists whose name column gives way (DataTable `fill`): on a laptop the table fits its card
const FITTING_TABLES = ["/content", "/inventory"]

interface Room {
  /** How far the page scrolls sideways. */
  page: number
  /** The header's parts reaching past the window or under its own edge. */
  header: string[]
  /** The title's width, too narrow to read beside its actions. */
  title: number
  /** The search box beside the list's filters. */
  search: number | null
}

function room(page: Page): Promise<Room> {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement
    const header = document.querySelector("#content header")
    const edge = header?.getBoundingClientRect().right ?? window.innerWidth
    const outside = header
      ? Array.from(header.querySelectorAll("a, button, h1, p"))
          .filter((el) => el.getBoundingClientRect().right > Math.min(edge, window.innerWidth) + 1)
          .map((el) => `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}"`)
      : []
    const search = document.querySelector(
      "main [data-filter-bar] input[type=search], main [data-filter-bar] input"
    )
    return {
      page: root.scrollWidth - window.innerWidth,
      header: outside,
      title: Math.round(
        document.querySelector("main h1")?.parentElement?.getBoundingClientRect().width ?? 0
      ),
      search: search ? Math.round(search.getBoundingClientRect().width) : null,
    }
  })
}

/**
 * The main lists keep their header, toolbar and table within the window
 * (the owner 2026-11-26, the panel-wide audit after the product page's
 * header): no sideways page, no header button past the edge, a title
 * never squeezed beside its actions, a search box wide enough to type in.
 * Read only.
 */
test("keeps the main lists' header and toolbar within the window", async ({ page, guard }) => {
  test.setTimeout(LISTS.length * WIDTHS.length * 10_000)
  const found: Record<string, unknown> = {}
  for (const path of LISTS) {
    for (const size of WIDTHS) {
      await test.step(`${path} at ${String(size.width)}`, async () => {
        await page.setViewportSize(size)
        await page.goto(path)
        await expect(pageHeading(page)).toBeVisible()
        await page.waitForLoadState("networkidle")
        const measured = await room(page)
        const problems = [
          ...(measured.page > 0 ? [`page scrolls ${String(measured.page)}px`] : []),
          ...measured.header.map((part) => `header part past the edge: ${part}`),
          // 18rem less the gaps: the title's own floor (PageHeader) or the whole row on a phone
          ...(measured.title < 200 ? [`title squeezed to ${String(measured.title)}px`] : []),
          ...(measured.search !== null && measured.search < 150
            ? [`search squeezed to ${String(measured.search)}px`]
            : []),
        ]
        if (size.width >= 1024 && FITTING_TABLES.includes(path)) {
          const sideways = await page
            .locator('main [data-slot="table-container"]')
            .first()
            .evaluate((box) => box.scrollWidth - box.clientWidth)
          if (sideways > 0) {
            problems.push(`table scrolls ${String(sideways)}px`)
          }
        }
        if (problems.length > 0) {
          found[`${path} at ${String(size.width)}`] = problems
        }
      })
    }
  }
  expect(found).toEqual({})
  await guard.assertHealthy()
})

/**
 * The orders' header (the product page's pattern, PR #434): the export and
 * "Yeni sipariş" as buttons, the queues in one "…" menu, which opens them.
 */
test("puts the orders' queues in the header's menu", async ({ page, guard }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/orders")
  await expect(pageHeading(page)).toBeVisible()
  const header = page.locator("#content header")
  // Not side by side any more: none of the queues is a button of its own
  await expect(header.getByRole("link", { name: "İade talepleri" })).toHaveCount(0)
  await header.getByRole("button", { name: "Diğer işlemler" }).click()
  for (const queue of ["İnceleme", "İade talepleri", "Ters ibrazlar", "Faturalar"]) {
    await expect(page.getByRole("menuitem", { name: queue })).toBeVisible()
  }
  await page.getByRole("menuitem", { name: "İade talepleri" }).click()
  await expect(page).toHaveURL(/\/orders\/returns/)
  await guard.assertHealthy()
})
