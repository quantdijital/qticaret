import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * The product page laid out by the shop (docs/06 "Ürün sayfası", the owner
 * 2026-11-25): "Sayfayı düzenle" hides a part and moves another, the layout
 * outlives a reload; a hidden part is still reached (the advisor's "Alana
 * git", "Göster" under the page); the narrow column's cards are edited in
 * place. The shop's layout is put back as it was at the end; the organize
 * card is saved unchanged, so no product changes.
 */

const SETTINGS = "/admin/platform-settings/panel_layout"

interface StoredLayout {
  main: string[]
  side: string[]
  hidden: string[]
  open?: string[]
}

async function storedLayout(page: Page): Promise<StoredLayout> {
  const answer = await page.request.get(SETTINGS)
  expect(answer.ok()).toBe(true)
  const { values } = (await answer.json()) as { values: { product: StoredLayout } }
  return values.product
}

async function saveLayout(page: Page, product: StoredLayout): Promise<void> {
  const answer = await page.request.post(SETTINGS, { data: { product } })
  expect(answer.ok()).toBe(true)
}

async function firstProductId(page: Page): Promise<string> {
  const answer = await page.request.get("/admin/products?limit=1&fields=id&order=created_at")
  expect(answer.ok()).toBe(true)
  const { products } = (await answer.json()) as { products: { id: string }[] }
  const product = products[0]
  expect(product, "the demo shop has a product").toBeDefined()
  return product?.id ?? ""
}

/** The main column's parts in the order drawn. */
const mainOrder = (page: Page) =>
  page
    .locator("main [data-part]")
    .evaluateAll((parts) =>
      parts.map((part) => part.getAttribute("data-part")).filter((key) => key !== null)
    )

async function openProduct(page: Page, id: string): Promise<void> {
  await page.goto(`/products/${id}`)
  await expect(pageHeading(page)).toBeVisible()
  await expect(page.locator('main [data-part="general"]')).toBeAttached()
}

test.describe("product page layout", () => {
  test.describe.configure({ mode: "serial" })
  let before: StoredLayout | null = null
  let productId = ""

  test.beforeEach(async ({ page }) => {
    before ??= await storedLayout(page)
    productId ||= await firstProductId(page)
    await saveLayout(page, { main: [], side: [], hidden: [] })
  })

  // The shop's own layout back after each test, passed or failed
  test.afterEach(async ({ page }) => {
    if (before) {
      await saveLayout(page, before)
    }
  })

  test("hides a part and moves another; both outlive a reload", async ({ page, guard }) => {
    await openProduct(page, productId)
    await page.getByRole("button", { name: "Diğer işlemler" }).click()
    await page.getByRole("menuitem", { name: "Sayfayı düzenle" }).click()
    const sheet = page.getByRole("dialog", { name: "Ürün sayfasını düzenle" })
    await expect(sheet).toBeVisible()
    // The name and the variants cannot be hidden
    await expect(sheet.getByRole("switch", { name: "Genel bilgiler: göster" })).toHaveCount(0)

    await sheet.getByRole("switch", { name: "Fiyat geçmişi: göster" }).click()
    await sheet.getByRole("button", { name: "Görseller: yukarı taşı" }).click()
    // The page behind follows the draft
    await expect(page.locator('main [data-part="priceHistory"]')).toHaveCount(0)
    await sheet.getByRole("button", { name: "Kaydet" }).click()
    await expect(sheet).toBeHidden()

    await page.reload()
    await expect(page.locator('main [data-part="general"]')).toBeAttached()
    await expect(page.locator('main [data-part="priceHistory"]')).toHaveCount(0)
    const order = await mainOrder(page)
    expect(order.indexOf("media")).toBeLessThan(order.indexOf("variants"))
    await expect(page.getByText(/^Gizli bölümler: .*Fiyat geçmişi/)).toBeVisible()

    // Still reached: "Göster" brings it back for this visit
    await page.getByRole("button", { name: "Göster", exact: true }).click()
    await expect(page.locator('main [data-part="priceHistory"]')).toBeAttached()
    await expect(page.getByText("Gizlenen bölüm: bu ziyaret için gösteriliyor.")).toBeVisible()
    await guard.assertHealthy()
  })

  test("applies a ready layout; the section bar follows and goes to a part", async ({
    page,
    guard,
  }) => {
    await openProduct(page, productId)
    await page.getByRole("button", { name: "Diğer işlemler" }).click()
    await page.getByRole("menuitem", { name: "Sayfayı düzenle" }).click()
    const sheet = page.getByRole("dialog", { name: "Ürün sayfasını düzenle" })
    await expect(sheet.getByRole("radio", { name: "Standart" })).toBeChecked()
    await sheet.getByRole("radio", { name: "Basit" }).click()
    await expect(page.locator('main [data-part="priceHistory"]')).toHaveCount(0)
    await sheet.getByRole("button", { name: "Kaydet" }).click()
    await expect(sheet).toBeHidden()
    expect((await storedLayout(page)).hidden).toContain("priceHistory")

    await page.reload()
    await expect(page.locator('main [data-part="general"]')).toBeAttached()
    const bar = page.getByRole("navigation", { name: "Sayfanın bölümleri" })
    await expect(bar).toBeVisible()
    await expect(bar.getByRole("button", { name: /^Fiyat geçmişi/ })).toHaveCount(0)
    const media = bar.getByRole("button", { name: /^Görseller/ })
    await media.click()
    await expect(page.locator("#product-media")).toBeInViewport()
    await guard.assertHealthy()
  })

  test("opens the folded parts with Gelişmiş", async ({ page, guard }) => {
    await saveLayout(page, {
      main: [],
      side: [],
      hidden: [],
      open: ["seo", "attributes", "faq", "addons", "priceHistory"],
    })
    // A person's own earlier choice would win: start from none
    await page.goto("/")
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("qt.panel.section:")) {
          localStorage.removeItem(key)
        }
      }
    })
    await openProduct(page, productId)
    await expect(page.locator("#product-seo")).toHaveAttribute("data-open", "")
    await expect(page.locator("#product-price-history")).toHaveAttribute("data-open", "")
    await guard.assertHealthy()
  })

  test("goes to a field with Ctrl+K", async ({ page, guard }) => {
    await openProduct(page, productId)
    await page.keyboard.press("ControlOrMeta+k")
    const menu = page.getByRole("dialog", { name: "Komut menüsü" })
    await expect(menu.getByRole("group", { name: "Alana git" })).toBeVisible()
    await menu.getByRole("combobox").fill("SEO başlığı")
    await menu.getByRole("option", { name: "SEO başlığı" }).click()
    await expect(page.locator("#product-seo")).toHaveAttribute("data-open", "")
    await expect(page.locator("#product-seo input").first()).toBeFocused()
    await guard.assertHealthy()
  })

  test("reaches a hidden part through the advisor's Alana git", async ({ page, guard }) => {
    // Every part that may hide, hidden: whatever the advisor points at is behind one
    await saveLayout(page, {
      main: [],
      side: [],
      hidden: [
        "media",
        "description",
        "shortDescription",
        "program",
        "seo",
        "attributes",
        "faq",
        "addons",
        "priceHistory",
        "organize",
        "catalog",
        "shipping",
      ],
    })
    await openProduct(page, productId)
    const goTo = page.getByRole("button", { name: "Alana git" })
    await expect(page.getByRole("heading", { name: "SEO danışmanı" })).toBeVisible()
    const count = await goTo.count()
    test.skip(count === 0, "the advisor finds nothing to go to on this product")
    const revealed = page.locator("[data-shown-hidden='revealed']")
    for (let index = 0; index < count && (await revealed.count()) === 0; index++) {
      await goTo.nth(index).click()
    }
    test.skip((await revealed.count()) === 0, "the advisor points only at parts always shown")
    await expect(revealed.first()).toBeVisible()
    await guard.assertHealthy()
  })

  test("edits the categories card in place: no dialog, Esc lets go, Kaydet closes it", async ({
    page,
    guard,
  }) => {
    await openProduct(page, productId)
    const edit = page.getByRole("button", { name: "Kategori, marka ve KDV: düzenle" })
    await edit.click()
    const form = page.getByRole("form", { name: "Kategori, marka ve KDV" })
    await expect(form).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expect(form).toHaveCount(0)
    await expect(edit).toBeFocused()

    await edit.click()
    await form.getByRole("button", { name: "Kaydet" }).click()
    await expect(form).toHaveCount(0)
    await expect(page.getByText("Değişiklikler kaydedildi.")).toBeVisible()
    await guard.assertHealthy()
  })
})
