import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { pathOf, PRODUCT_PAGE, purchasePath, searchPath, stockedProduct } from "./catalog"
import { addToCart, dismissCookies } from "./support"

/**
 * The frame's newer parts (docs/19 §4, §7): the phone's bottom bar and
 * the maintenance bypass link (adr/0053). The shop is open in the dev
 * database, so the dark page itself is the unit tests'; here the link's
 * own answers and the headers every page keeps.
 */

const PHONE = { width: 390, height: 844 }

const bottomBar = (page: Page) => page.getByRole("navigation", { name: "Hızlı gezinme" })

test.describe("the phone's bottom bar", () => {
  test.use({ viewport: PHONE })

  test("is on the shop's pages at 390 px, the page's item marked, the cart's count in its name", async ({
    page,
  }) => {
    await page.goto("/")
    await dismissCookies(page)
    const bar = bottomBar(page)
    await expect(bar).toBeVisible()
    await expect(bar.getByRole("link", { name: "Ana sayfa" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    await expect(bar.getByRole("link", { name: "Kategoriler" })).toHaveAttribute(
      "href",
      "/kategoriler"
    )
    await expect(bar.getByRole("link", { name: "Ara" })).toHaveAttribute("href", "/arama")
    await expect(bar.getByRole("link", { name: /^Sepet, \d+ ürün$/ })).toHaveAttribute(
      "href",
      "/sepet"
    )
    await expect(bar.getByRole("link", { name: "Hesabım" })).toHaveAttribute("href", "/hesap")
    // The bar's room is held at the foot of the page: the footer ends above it
    const footer = await page.locator("footer").last().boundingBox()
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    expect((footer?.y ?? 0) + (footer?.height ?? 0)).toBeLessThanOrEqual(height - 60)

    await page.goto(searchPath(await stockedProduct()))
    await expect(bottomBar(page).getByRole("link", { name: "Ara" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    await expect(bottomBar(page).getByRole("link", { name: "Ana sayfa" })).not.toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  test("opens the menu drawer from Kategoriler, and gives the focus back", async ({ page }) => {
    await page.goto("/")
    await dismissCookies(page)
    const categories = bottomBar(page).getByRole("link", { name: "Kategoriler" })
    await categories.click()
    const drawer = page.getByRole("dialog", { name: "Menü" })
    await expect(drawer).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    await page.keyboard.press("Escape")
    await expect(drawer).toBeHidden()
    await expect(categories).toBeFocused()
  })

  test("stays away from the checkout", async ({ page }) => {
    await page.goto("/odeme/durum?d=gecikti")
    await expect(page.locator("h1").first()).toBeVisible()
    await expect(bottomBar(page)).toHaveCount(0)

    // A cart, made at desktop width where the purchase form stands free
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(purchasePath(await stockedProduct()))
    await dismissCookies(page)
    await addToCart(page)
    await page.setViewportSize(PHONE)
    const checkout = await page.goto("/odeme")
    expect(checkout?.status()).toBe(200)
    await expect(page).toHaveURL(/\/odeme$/)
    await expect(bottomBar(page)).toHaveCount(0)
    await page.goto("/sepet")
    await expect(
      bottomBar(page).getByRole("link", { name: /^Sepet, [1-9]\d* ürün$/ })
    ).toHaveAttribute("aria-current", "page")
  })

  test("has no serious axe finding at phone width", async ({ page }) => {
    for (const path of ["/", PRODUCT_PAGE, "/kategoriler"]) {
      await page.goto(await pathOf(path))
      await dismissCookies(page)
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      const serious = result.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical"
      )
      expect(
        serious.map((violation) => `${path} ${violation.id}: ${violation.nodes.length}`)
      ).toEqual([])
    }
  })
})

test.describe("the maintenance bypass link", () => {
  test("a malformed link answers the 503 page saying so, never stored nor indexed", async ({
    page,
  }) => {
    const response = await page.goto("/bakim/gir?t=bozuk")
    expect(response?.status()).toBe(503)
    const headers = response?.headers() ?? {}
    expect(Number(headers["retry-after"])).toBeGreaterThanOrEqual(300)
    expect(headers["cache-control"]).toBe("no-store")
    expect(headers["x-robots-tag"]).toContain("noindex")
    expect(headers["referrer-policy"]).toBe("no-referrer")
    expect(headers["content-security-policy"]).toMatch(/style-src 'self' /)
    await expect(page.locator("h1")).toHaveText("Bağlantı geçersiz")
    // Without the theme: no menu, no search, no cart
    await expect(page.getByRole("navigation")).toHaveCount(0)
    expect(headers["set-cookie"] ?? "").not.toContain("qt_bypass")
  })

  test("a well-formed link while the shop is open goes home, with no cookie", async ({
    request,
  }) => {
    const token = `mnb_AbCdEfGhIjKlMnOp.zzzzzzzz.${"A".repeat(43)}`
    const response = await request.get(`/bakim/gir?t=${token}`, { maxRedirects: 0 })
    expect(response.status()).toBe(303)
    expect(new URL(response.headers()["location"] ?? "", "http://x").pathname).toBe("/")
    expect(response.headers()["set-cookie"] ?? "").not.toContain("qt_bypass")
    expect(response.headers()["referrer-policy"]).toBe("no-referrer")
  })
})

test("a normal page keeps its security headers and status while the shop is open", async ({
  page,
}) => {
  for (const path of ["/", PRODUCT_PAGE, "/kategoriler"]) {
    const response = await page.goto(await pathOf(path))
    expect(response?.status()).toBe(200)
    const headers = response?.headers() ?? {}
    expect(headers["x-content-type-options"]).toBe("nosniff")
    expect(headers["x-frame-options"]).toBe("DENY")
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin")
    expect(headers["retry-after"]).toBeUndefined()
    const csp = headers["content-security-policy"] ?? ""
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
    expect(csp).toContain("frame-ancestors 'none'")
  }
})
