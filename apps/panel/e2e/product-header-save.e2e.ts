import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * The product page's one save in its header (docs/06 "Ürün sayfası", the
 * owner 2026-11-26, WordPress's "Güncelle"): two cards changed are saved
 * together from the header's "Kaydet", held in sight while scrolling; Ctrl/⌘+S
 * saves, and a product of one variant takes its price right in the "Ürün
 * verileri" card, kept while another tab is open.
 * Every change is put back as it was before the test ends.
 */

interface ProductRow {
  id: string
  title: string
  variants: { id: string; prices?: { amount: number; currency_code: string }[] }[]
}

async function products(page: Page): Promise<ProductRow[]> {
  const answer = await page.request.get(
    "/admin/products?limit=50&order=created_at&fields=id,title,variants.id,variants.prices.amount,variants.prices.currency_code"
  )
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { products: ProductRow[] }).products
}

async function product(page: Page, id: string): Promise<ProductRow> {
  const answer = await page.request.get(
    `/admin/products/${id}?fields=id,title,variants.id,variants.prices.amount,variants.prices.currency_code`
  )
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { product: ProductRow }).product
}

async function openProduct(page: Page, id: string): Promise<void> {
  await page.goto(`/products/${id}`)
  await expect(pageHeading(page)).toBeVisible()
  await expect(page.locator('main [data-part="general"]')).toBeAttached()
}

const headerSave = (page: Page) => page.getByRole("group", { name: "Sayfanın kaydı" })
const saveButton = (page: Page) =>
  headerSave(page).getByRole("button", { name: "Kaydet", exact: true })
const saved = (page: Page) =>
  headerSave(page).getByRole("button", { name: "Kaydedildi", exact: true })

test.describe("product page header save", () => {
  test.describe.configure({ mode: "serial" })

  test("saves two changed cards from the header, then Ctrl+S puts them back", async ({
    page,
    guard,
  }) => {
    const first = (await products(page))[0]
    test.skip(!first, "the demo shop has no product")
    const id = first?.id ?? ""
    const title = first?.title ?? ""
    await openProduct(page, id)

    const name = page.locator("#detail-title")
    await name.fill(`${title} Pro`)
    const handle = page.locator("#detail-handle")
    const address = await handle.inputValue()
    // A second card: the search appearance, opened from its folded line (the
    // section bar above carries a link-button of the same name). An urgent
    // advisor finding opens it by itself: a click then would fold it again.
    const fold = page
      .locator("#product-seo")
      .getByRole("button", { name: "Arama motoru görünümü", exact: true })
    if ((await fold.getAttribute("aria-expanded")) === "false") {
      await fold.click()
    }
    const seoTitle = page.locator("#product-seo input").first()
    const seoBefore = await seoTitle.inputValue()
    await seoTitle.fill(`${title} – özel`)

    await expect(headerSave(page)).toContainText("2 bölümde")
    // Scrolled down to the second card, the header's save is still in sight
    await expect(saveButton(page)).toBeInViewport()
    await saveButton(page).click()
    await expect(saved(page)).toBeDisabled()
    await expect.poll(async () => (await product(page, id)).title).toBe(`${title} Pro`)
    // The name changed, not the address (it keeps the product's link)
    await expect(handle).toHaveValue(address)

    // Back as it was, saved by the keyboard
    await name.fill(title)
    await seoTitle.fill(seoBefore)
    await expect(saveButton(page)).toBeEnabled()
    await page.keyboard.press("ControlOrMeta+s")
    await expect(saved(page)).toBeDisabled()
    await expect.poll(async () => (await product(page, id)).title).toBe(title)
    await guard.assertHealthy()
  })

  test("lets every change go from the header after asking", async ({ page, guard }) => {
    const first = (await products(page))[0]
    test.skip(!first, "the demo shop has no product")
    await openProduct(page, first?.id ?? "")
    const name = page.locator("#detail-title")
    const before = await name.inputValue()
    await name.fill(`${before} Pro`)
    await headerSave(page).getByRole("button", { name: "Vazgeç" }).click()
    await page.getByRole("button", { name: "Değişiklikleri at" }).click()
    await expect(name).toHaveValue(before)
    await expect(saved(page)).toBeDisabled()
    await guard.assertHealthy()
  })

  test("edits a single variant's price in the card and saves it", async ({ page, guard }) => {
    const single = (await products(page)).find((each) => each.variants.length === 1)
    test.skip(!single, "the demo shop has no product of one variant")
    const id = single?.id ?? ""
    const lira = () =>
      product(page, id).then(
        (row) =>
          row.variants[0]?.prices?.find((price) => price.currency_code.toLowerCase() === "try")
            ?.amount
      )
    const before = await lira()
    test.skip(before === undefined, "the variant has no lira price")
    await openProduct(page, id)
    await expect(page.getByRole("dialog")).toHaveCount(0)
    // A simple product's price is in the data card's Genel tab; one with an option, in Varyantlar
    const data = page.locator("#product-data")
    const typeSelect = data.getByRole("combobox", { name: "Ürün tipi" })
    await expect(typeSelect).toBeVisible()
    const variable = (await typeSelect.textContent())?.includes("Varyantlı") ?? false
    await data.getByRole("tab", { name: variable ? "Varyantlar" : "Genel" }).click()
    const price = page.locator("#single-price")
    await expect(price).toBeVisible()
    const shown = await price.inputValue()

    await price.fill("1.234,50")
    await expect(saveButton(page)).toBeEnabled()
    // Another tab open, the edit is kept and still saved
    await data.getByRole("tab", { name: "Katalog" }).click()
    await expect(price).toBeHidden()
    await page.keyboard.press("ControlOrMeta+s")
    await expect(saved(page)).toBeDisabled()
    await expect.poll(lira).toBe(1234.5)

    await data.getByRole("tab", { name: variable ? "Varyantlar" : "Genel" }).click()
    await price.fill(shown)
    await page.keyboard.press("ControlOrMeta+s")
    await expect.poll(lira).toBe(before)
    await guard.assertHealthy()
  })
})
