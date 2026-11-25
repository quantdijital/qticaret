import type { Locator, Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"
import { dialogIssues } from "./support/dialog"

// A desktop and a phone (docs/18 §9)
const SIZES = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]
const PER_DIALOG_MS = 12_000

interface Case {
  name: string
  path: string
  /** Opens the dialog; false when this shop has nothing to open it on (the run says so). */
  open: (page: Page) => Promise<boolean>
}

const click = (name: string | RegExp) => async (page: Page) => {
  await page.getByRole("button", { name }).first().click()
  return true
}

/** The first of the list's newest orders whose menu offers this action (a paid one for a refund). */
const orderAction = (action: string) => async (page: Page) => {
  const links = await page
    .locator("main table tbody tr a")
    .evaluateAll((anchors) => anchors.slice(0, 10).map((anchor) => anchor.getAttribute("href")))
  for (const href of links) {
    if (!href) {
      continue
    }
    await page.goto(href)
    await expect(pageHeading(page)).toBeVisible()
    await page.waitForLoadState("networkidle")
    const more = page.getByRole("button", { name: "Diğer işlemler" })
    if ((await more.count()) === 0) {
      continue
    }
    await more.click()
    const item = page.getByRole("menuitem", { name: action })
    if ((await item.count()) > 0) {
      await item.click()
      return true
    }
    await page.keyboard.press("Escape")
  }
  return false
}

/** A product of several variants from the list's newest, then an action on its page. */
const productAction = (open: (page: Page) => Promise<void>) => async (page: Page) => {
  const links = await page
    .locator("main table tbody tr a")
    .evaluateAll((anchors) => anchors.slice(0, 10).map((anchor) => anchor.getAttribute("href")))
  for (const href of links) {
    if (!href) {
      continue
    }
    await page.goto(href)
    await expect(pageHeading(page)).toBeVisible()
    await page.waitForLoadState("networkidle")
    if ((await page.locator("[data-variant-row]").count()) > 0) {
      await open(page)
      return true
    }
  }
  return false
}

/** The list's first row, opening its record; false while the list is empty. */
const firstRow = async (page: Page) => {
  const rows = page.locator("main table tbody tr.cursor-pointer")
  if ((await rows.count()) === 0) {
    return false
  }
  await rows.first().click()
  return true
}

/** The first of what the selector finds, when there is one: a card or a row's own button. */
const firstOf = (selector: string | ((page: Page) => Locator)) => async (page: Page) => {
  const found = typeof selector === "string" ? page.locator(selector) : selector(page)
  if ((await found.count()) === 0) {
    return false
  }
  await found.first().click()
  return true
}

/**
 * Dialogs that open without writing anything; each one is only looked at
 * and closed. Opening a refund asks the server for a preview, nothing more.
 */
const CASES: Case[] = [
  { name: "order refund", path: "/orders", open: orderAction("Para iadesi") },
  { name: "order edit", path: "/orders", open: orderAction("Siparişi düzenle") },
  { name: "order cancel", path: "/orders", open: orderAction("Siparişi iptal et") },
  { name: "command menu", path: "/", open: click(/Ara ya da bir sayfaya git/) },
  { name: "product import", path: "/products", open: click("İçe aktar") },
  { name: "new segment", path: "/customers/groups", open: click("Yeni segment") },
  { name: "team invite", path: "/settings/security?part=team", open: click("Davet et") },
  { name: "new API key", path: "/settings/api", open: click("Yeni anahtar") },
  { name: "new redirect", path: "/settings/seo?part=redirects", open: click("Yönlendirme ekle") },
  { name: "new menu", path: "/storefront/menus", open: click("Menü ekle") },
  { name: "new location", path: "/settings/shipping?part=locations", open: click("Depo ekle") },
  // The owner, 2026-11-05: a variant in one dialog, the media dialog on the size scale
  {
    name: "variant",
    path: "/products",
    open: productAction(async (page) => {
      await page.locator("[data-variant-row]").first().click()
    }),
  },
  {
    name: "media picker",
    path: "/products",
    open: productAction(async (page) => {
      // "Görsel ya da video ekle" while the product takes a video (adr/0069), else "Görsel ekle"
      await page
        .getByRole("button", { name: /^Görsel( ya da video)? ekle: / })
        .first()
        .click()
    }),
  },
  // The owner, 2026-11-06: the side sheets that showed a record became the standard dialog
  { name: "audit entry", path: "/settings/audit", open: firstRow },
  { name: "contact message", path: "/customers/contact-messages", open: firstRow },
  { name: "blog category", path: "/content?kind=category", open: firstRow },
  {
    name: "stock history",
    path: "/inventory",
    open: firstOf('main button[aria-label$="stok geçmişi"]'),
  },
  { name: "attribute template", path: "/settings/attributes", open: firstRow },
  { name: "media detail", path: "/media", open: firstOf("main ul > li > button") },
]

/**
 * The owner, 2026-11-03: "ürün için para iadesi modalı ui tarafı bozuk".
 * Every dialog here, on a desktop and on a phone, stays on the screen,
 * keeps its rows inside its box, keeps its footer in reach with buttons of
 * one height, and is a sheet along the bottom edge on a phone
 * (support/dialog.ts). Read only.
 */
for (const size of SIZES) {
  test(`keeps every dialog whole at ${String(size.width)}×${String(size.height)}`, async ({
    page,
    guard,
  }) => {
    test.setTimeout(CASES.length * PER_DIALOG_MS)
    await page.setViewportSize(size)
    const found: Record<string, string[]> = {}
    for (const each of CASES) {
      await test.step(each.name, async () => {
        await page.goto(each.path)
        await expect(pageHeading(page)).toBeVisible()
        await page.waitForLoadState("networkidle")
        if (!(await each.open(page))) {
          test.info().annotations.push({
            type: "skip",
            description: `${each.name}: nothing in this shop to open it on`,
          })
          return
        }
        const box = page.locator(
          "[role=dialog][data-state=open], [role=alertdialog][data-state=open]"
        )
        await expect(box.first()).toBeVisible()
        await page.waitForLoadState("networkidle")
        const issues = await dialogIssues(page)
        if (issues.length > 0) {
          found[each.name] = issues
        }
        await guard.assertHealthy()
        await page.keyboard.press("Escape")
      })
    }
    expect(found).toEqual({})
  })
}
