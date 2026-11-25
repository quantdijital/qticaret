import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * The product page's one save bar (docs/06 "Ürün sayfası", the owner
 * 2026-11-25): two cards changed are saved together from the bar, Ctrl/⌘+S
 * saves, and a product of one variant takes its price right in the card.
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
    // A second card: the search appearance, opened from its fold's own header (the section bar
    // has a chip of the same name). It may start open (docs/06: a fold with a critical or high
    // advisor finding, or the shop's "Gelişmiş" layout), and a click on an open fold closes it;
    // its default is known once the page's requests have settled
    await page.waitForLoadState("networkidle")
    const fold = page
      .locator("main section > header h2")
      .getByRole("button", { name: "Arama motoru görünümü", exact: true })
    if ((await fold.getAttribute("aria-expanded")) !== "true") {
      await fold.click()
    }
    await expect(fold).toHaveAttribute("aria-expanded", "true")
    const seoTitle = page.locator("#product-seo input").first()
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
    const price = page.locator("#single-price")
    await expect(price).toBeVisible()
    const shown = await price.inputValue()

    await price.fill("1.234,50")
    await expect(saveBar(page)).toBeVisible()
    await page.keyboard.press("ControlOrMeta+s")
    await expect(saveBar(page)).toHaveCount(0)
    await expect.poll(lira).toBe(1234.5)

    await price.fill(shown)
    await page.keyboard.press("ControlOrMeta+s")
    await expect.poll(lira).toBe(before)
    // Everything else about it is still one click away
    await page.getByRole("button", { name: "Tüm varyant ayrıntıları" }).click()
    await expect(page.getByRole("dialog", { name: /Varyantı düzenle/ })).toBeVisible()
    await guard.assertHealthy()
  })
})
