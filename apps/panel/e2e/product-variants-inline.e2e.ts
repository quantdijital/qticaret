import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * Variants in place (docs/06 "Ürün sayfası", the owner 2026-11-25:
 * WooCommerce's variations, no dialog): a value typed into an option,
 * "Varyantları oluştur" makes the missing variant, its row opens in place
 * and the page's "Kaydet" in the header saves its price, and the bulk bar sets the stock
 * of every variant. The test makes its own draft product and deletes it at
 * the end: nothing of the shop's own changes.
 */

interface Level {
  location_id: string
  stocked_quantity: number
}

interface VariantRow {
  id: string
  title: string
  prices?: { amount: number; currency_code: string }[]
  inventory_items?: { inventory?: { location_levels?: Level[] } }[]
}

const FIELDS =
  "id,variants.id,variants.title,variants.prices.amount,variants.prices.currency_code,variants.inventory_items.inventory.location_levels.location_id,variants.inventory_items.inventory.location_levels.stocked_quantity"

async function variants(page: Page, id: string): Promise<VariantRow[]> {
  const answer = await page.request.get(`/admin/products/${id}?fields=${FIELDS}`)
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { product: { variants: VariantRow[] } }).product.variants
}

async function defaultLocation(page: Page): Promise<string | null> {
  const answer = await page.request.get("/admin/stores?fields=id,default_location_id")
  expect(answer.ok()).toBe(true)
  const { stores } = (await answer.json()) as { stores: { default_location_id: string | null }[] }
  return stores[0]?.default_location_id ?? null
}

/** A draft of two colours, priced and counted: never shown in the storefront. */
async function makeProduct(page: Page): Promise<string> {
  const answer = await page.request.post("/admin/products", {
    data: {
      title: "Deri Kartlık",
      status: "draft",
      options: [{ title: "Renk", values: ["Taba", "Siyah"] }],
      variants: ["Taba", "Siyah"].map((value, rank) => ({
        title: value,
        variant_rank: rank,
        manage_inventory: true,
        prices: [{ currency_code: "try", amount: 650 }],
        options: { Renk: value },
      })),
    },
  })
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { product: { id: string } }).product.id
}

const headerSave = (page: Page) => page.getByRole("group", { name: "Sayfanın kaydı" })

test.describe("product variants in place", () => {
  test("creates a variant from a new value, prices it in its row and sets every stock", async ({
    page,
    guard,
  }) => {
    const location = await defaultLocation(page)
    test.skip(!location, "the shop has no default stock location")
    const id = await makeProduct(page)
    try {
      await page.goto(`/products/${id}`)
      await expect(pageHeading(page)).toBeVisible()
      // The variants are a tab of the "Ürün verileri" card of a product with variants
      const data = page.locator("#product-data")
      await expect(data.getByRole("combobox", { name: "Ürün tipi" })).toHaveText("Varyantlı ürün")
      await data.getByRole("tab", { name: "Varyantlar" }).click()
      await expect(page.locator("[data-variant-row]")).toHaveCount(2)

      // A value typed into the option, the missing variant made
      await page.getByRole("button", { name: "Seçenekleri düzenle" }).click()
      await page.getByRole("textbox", { name: "Renk değerleri" }).fill("Lacivert")
      await page.keyboard.press("Enter")
      await expect(page.getByText(/1 varyant oluşturulacak/)).toBeVisible()
      await page.getByRole("button", { name: "1 varyantı oluştur" }).click()
      await expect(page.locator("[data-variant-row]")).toHaveCount(3)
      await expect.poll(async () => (await variants(page, id)).length).toBe(3)

      // Its row opens in place, no dialog; the header's "Kaydet" saves its price
      const row = page.getByRole("button", { name: /Renk: Lacivert/ })
      await expect(row).toContainText("Fiyat yok")
      await row.click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await page.locator("#variant-price").fill("719,90")
      const save = headerSave(page).getByRole("button", { name: "Kaydet", exact: true })
      await expect(save).toBeEnabled()
      await save.click()
      await expect(
        headerSave(page).getByRole("button", { name: "Kaydedildi", exact: true })
      ).toBeDisabled()
      await expect
        .poll(async () => {
          const made = (await variants(page, id)).find((each) => each.title === "Lacivert")
          return made?.prices?.find((price) => price.currency_code === "try")?.amount
        })
        .toBe(719.9)

      // One stock count for every variant
      const bar = page.getByRole("group", { name: "Toplu değişiklik" })
      await bar.getByRole("combobox", { name: "Değiştirilecek alan" }).click()
      await page.getByRole("option", { name: "Stok adedi" }).click()
      await bar.getByRole("spinbutton", { name: "Yeni değer" }).fill("5")
      await bar.getByRole("button", { name: "3 varyanta uygula" }).click()
      await expect
        .poll(async () =>
          (await variants(page, id)).map(
            (each) =>
              each.inventory_items?.[0]?.inventory?.location_levels?.find(
                (level) => level.location_id === location
              )?.stocked_quantity
          )
        )
        .toEqual([5, 5, 5])
      await guard.assertHealthy()
    } finally {
      // The draft goes as it came
      await page.request.delete(`/admin/products/${id}`)
    }
  })
})
