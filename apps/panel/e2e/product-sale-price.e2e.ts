import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * A variant's sale price (adr/0086, WooCommerce's "İndirimli fiyat"): typed
 * in its row under the regular price, the share off said beside it, saved
 * by the page's save bar, there again after a reload; then removed. The
 * test makes its own draft product, clears the sale and deletes the
 * product at the end: nothing of the shop's own changes.
 */

interface SaleRead {
  variants: { id: string; sale: { amount: string } | null }[]
}

async function makeProduct(page: Page): Promise<string> {
  const answer = await page.request.post("/admin/products", {
    data: {
      title: "Deri Cüzdan",
      status: "draft",
      options: [{ title: "Renk", values: ["Taba", "Siyah"] }],
      variants: ["Taba", "Siyah"].map((value, rank) => ({
        title: value,
        variant_rank: rank,
        manage_inventory: false,
        prices: [{ currency_code: "try", amount: 650 }],
        options: { Renk: value },
      })),
    },
  })
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { product: { id: string } }).product.id
}

async function sales(page: Page, id: string): Promise<(string | null)[]> {
  const answer = await page.request.get(`/admin/products/${id}/sale-prices`)
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as SaleRead).variants.map((each) => each.sale?.amount ?? null)
}

const saveBar = (page: Page) => page.getByRole("region", { name: "Kaydedilmemiş değişiklikler" })

async function openTaba(page: Page, id: string) {
  await page.goto(`/products/${id}`)
  await expect(pageHeading(page)).toBeVisible()
  await page.locator("#product-data").getByRole("tab", { name: "Varyantlar" }).click()
  await page.getByRole("button", { name: /Renk: Taba/ }).click()
}

test.describe("a variant's sale price", () => {
  test("sets it in the row through the save bar, shows it again, and removes it", async ({
    page,
    guard,
  }) => {
    const id = await makeProduct(page)
    try {
      await openTaba(page, id)
      const sale = page.locator("#variant-sale")
      await sale.fill("520")
      // 520 of 650 is 20% off; the regular price is left as it is
      await expect(page.getByText("%20 indirim")).toBeVisible()
      await expect(page.locator("#variant-price")).toHaveValue("650,00")
      await expect(saveBar(page)).toBeVisible()
      await saveBar(page).getByRole("button", { name: "Kaydet" }).click()
      await expect(saveBar(page)).toHaveCount(0)
      await expect.poll(() => sales(page, id)).toContain("520.00")

      await page.reload()
      await openTaba(page, id)
      await expect(page.locator("#variant-sale")).toHaveValue("520,00")
      await expect(page.getByText("%20 indirim")).toBeVisible()

      // Removed: the field empties, the save bar saves it
      await page.getByRole("button", { name: "İndirimi kaldır" }).click()
      await saveBar(page).getByRole("button", { name: "Kaydet" }).click()
      await expect(saveBar(page)).toHaveCount(0)
      await expect.poll(() => sales(page, id)).toEqual([null, null])
      await guard.assertHealthy()
    } finally {
      // The sale cleared and the draft gone, as they came
      const read = await page.request.get(`/admin/products/${id}/sale-prices`)
      if (read.ok()) {
        const ids = ((await read.json()) as SaleRead).variants.map((each) => each.id)
        await page.request.post(`/admin/products/${id}/sale-prices`, { data: { clear: ids } })
      }
      await page.request.delete(`/admin/products/${id}`)
    }
  })
})
