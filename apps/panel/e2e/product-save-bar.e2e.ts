import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * The product page's one save bar (docs/06 "Ürün sayfası", the owner
 * 2026-11-25): two cards changed are saved together from the bar, Ctrl/⌘+S
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

const saveBar = (page: Page) => page.getByRole("region", { name: "Kaydedilmemiş değişiklikler" })

test.describe("product page save bar", () => {
  test.describe.configure({ mode: "serial" })

  test("saves two changed cards from the bar, then Ctrl+S puts them back", async ({
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
    // advisor finding opens it by itself when the advisor answers, which may
    // land between a look and a click: the click then folds it again. So the
    // advisor's score is awaited first, and the card is opened until it
    // stays open (a look-then-click that raced is simply done once more).
    await expect(page.getByRole("img", { name: /^SEO puanı \d+\/100$/ }).first()).toBeVisible()
    const fold = page
      .locator("#product-seo")
      .getByRole("button", { name: "Arama motoru görünümü", exact: true })
    await expect(async () => {
      if ((await fold.getAttribute("aria-expanded")) === "false") {
        await fold.click()
      }
      await expect(fold).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 })
    }).toPass()
    const seoTitle = page.locator("#product-seo input").first()
    await expect(seoTitle).toBeVisible()
    const seoBefore = await seoTitle.inputValue()
    await seoTitle.fill(`${title} – özel`)

    await expect(saveBar(page)).toContainText("2 bölümde")
    await saveBar(page).getByRole("button", { name: "Kaydet" }).click()
    await expect(saveBar(page)).toHaveCount(0)
    await expect.poll(async () => (await product(page, id)).title).toBe(`${title} Pro`)
    // The name changed, not the address (it keeps the product's link)
    await expect(handle).toHaveValue(address)

    // Back as it was, saved by the keyboard
    await name.fill(title)
    await seoTitle.fill(seoBefore)
    await expect(saveBar(page)).toBeVisible()
    await page.keyboard.press("ControlOrMeta+s")
    await expect(saveBar(page)).toHaveCount(0)
    await expect.poll(async () => (await product(page, id)).title).toBe(title)
    await guard.assertHealthy()
  })

  test("lets every change go from the bar after asking", async ({ page, guard }) => {
    const first = (await products(page))[0]
    test.skip(!first, "the demo shop has no product")
    await openProduct(page, first?.id ?? "")
    const name = page.locator("#detail-title")
    const before = await name.inputValue()
    await name.fill(`${before} Pro`)
    await saveBar(page).getByRole("button", { name: "Vazgeç" }).click()
    await page.getByRole("button", { name: "Değişiklikleri at" }).click()
    await expect(name).toHaveValue(before)
    await expect(saveBar(page)).toHaveCount(0)
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
    await expect(saveBar(page)).toBeVisible()
    // Another tab open, the edit is kept and still saved
    await data.getByRole("tab", { name: "Katalog" }).click()
    await expect(price).toBeHidden()
    await page.keyboard.press("ControlOrMeta+s")
    await expect(saveBar(page)).toHaveCount(0)
    await expect.poll(lira).toBe(1234.5)

    await data.getByRole("tab", { name: variable ? "Varyantlar" : "Genel" }).click()
    await price.fill(shown)
    await page.keyboard.press("ControlOrMeta+s")
    await expect.poll(lira).toBe(before)
    await guard.assertHealthy()
  })
})
