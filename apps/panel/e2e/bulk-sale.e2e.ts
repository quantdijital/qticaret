import type { Page } from "@playwright/test"
import { expect, test } from "./support/guard"

/**
 * The product list's bulk sale (WooCommerce's bulk edit, adr/0086): a
 * share off each picked product's regular price, previewed (how many
 * change) before it is applied, worked out on the server; then cleared the
 * same way. The test makes its own draft product, clears its sale and
 * deletes it at the end: nothing of the shop's own changes.
 */

interface SaleRead {
  variants: { id: string; sale: { amount: string } | null }[]
}

const TITLE = `Toplu İndirim Kalemi ${String(Date.now())}`

async function makeProduct(page: Page): Promise<string> {
  const answer = await page.request.post("/admin/products", {
    data: {
      title: TITLE,
      status: "draft",
      options: [{ title: "Boy", values: ["Standart"] }],
      variants: [
        {
          title: "Standart",
          manage_inventory: false,
          prices: [{ currency_code: "try", amount: 400 }],
          options: { Boy: "Standart" },
        },
      ],
    },
  })
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { product: { id: string } }).product.id
}

async function sale(page: Page, id: string): Promise<string | null> {
  const answer = await page.request.get(`/admin/products/${id}/sale-prices`)
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as SaleRead).variants[0]?.sale?.amount ?? null
}

async function bulkSale(
  page: Page,
  pick: (dialog: ReturnType<Page["getByRole"]>) => Promise<void>
) {
  await page.goto(`/products?q=${encodeURIComponent(TITLE)}`)
  const table = page.getByRole("table")
  await expect(table.getByText(TITLE)).toBeVisible()
  await table.getByRole("checkbox").nth(1).check()
  const bar = page.getByRole("region", { name: "Seçili ürünler" })
  await bar.getByRole("button", { name: "Toplu düzenle" }).click()
  await page.getByRole("menuitem", { name: "İndirimli fiyat" }).click()
  const dialog = page.getByRole("dialog", { name: "İndirimli fiyat" })
  await pick(dialog)
  await dialog.getByRole("button", { name: "Önizle" }).click()
  // What it would do, before anything is written
  await expect(dialog.getByText("1 ürün değişecek.")).toBeVisible()
  await dialog.getByRole("button", { name: "1 ürüne uygula" }).click()
  await expect(dialog.getByText("1 ürün güncellendi.")).toBeVisible({ timeout: 30_000 })
  // The footer's button; the corner's close button has the same name
  await dialog.getByRole("button", { name: "Kapat" }).first().click()
  await expect(dialog).toBeHidden()
}

test.describe("the product list's bulk sale", () => {
  test("previews and applies a share off, then clears it", async ({ page, guard }) => {
    const id = await makeProduct(page)
    try {
      await bulkSale(page, async (dialog) => {
        await dialog.getByRole("radio", { name: "Yüzde indirim" }).check()
        await dialog.getByLabel("İndirim oranı (%)").fill("25")
        await expect(dialog.getByText("Örnek: ₺100,00 → ₺75,00")).toBeVisible()
      })
      // 25% off 400 is 300, worked out on the server
      await expect.poll(() => sale(page, id)).toBe("300.00")

      await bulkSale(page, async (dialog) => {
        await dialog.getByRole("radio", { name: "İndirimi kaldır" }).check()
      })
      await expect.poll(() => sale(page, id)).toBeNull()
      await guard.assertHealthy()
    } finally {
      const read = await page.request.get(`/admin/products/${id}/sale-prices`)
      if (read.ok()) {
        const ids = ((await read.json()) as SaleRead).variants.map((each) => each.id)
        await page.request.post(`/admin/products/${id}/sale-prices`, { data: { clear: ids } })
      }
      await page.request.delete(`/admin/products/${id}`)
    }
  })
})
