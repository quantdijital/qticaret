import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * Stock tracking turned on after a variant was made (docs/06 "Ürün
 * sayfası", the owner 2026-11-26: "varyantlı üründe stok miktarını
 * değiştiremiyor muyuz sonradan?"): an untracked variant's row gets the
 * "Stok takibi" switch, a count, the page's save bar saves both; turned
 * off, it is asked in place and the count is kept. The test makes its own
 * draft product and deletes it at the end.
 */

interface VariantRow {
  id: string
  title: string
  manage_inventory: boolean
  inventory_items?: {
    inventory?: { location_levels?: { location_id: string; stocked_quantity: number }[] }
  }[]
}

const FIELDS =
  "id,variants.id,variants.title,variants.manage_inventory,variants.inventory_items.inventory.location_levels.location_id,variants.inventory_items.inventory.location_levels.stocked_quantity"

async function variantOf(page: Page, id: string, title: string): Promise<VariantRow | undefined> {
  const answer = await page.request.get(`/admin/products/${id}?fields=${FIELDS}`)
  expect(answer.ok()).toBe(true)
  const { product } = (await answer.json()) as { product: { variants: VariantRow[] } }
  return product.variants.find((each) => each.title === title)
}

async function defaultLocation(page: Page): Promise<string | null> {
  const answer = await page.request.get("/admin/stores?fields=id,default_location_id")
  expect(answer.ok()).toBe(true)
  const { stores } = (await answer.json()) as { stores: { default_location_id: string | null }[] }
  return stores[0]?.default_location_id ?? null
}

/** A draft of two sizes whose stock is not counted: never shown in the storefront. */
async function makeProduct(page: Page): Promise<string> {
  const answer = await page.request.post("/admin/products", {
    data: {
      title: "Kamp Bıçağı",
      status: "draft",
      options: [{ title: "Boy", values: ["12 cm", "15 cm"] }],
      variants: ["12 cm", "15 cm"].map((value, rank) => ({
        title: value,
        variant_rank: rank,
        manage_inventory: false,
        prices: [{ currency_code: "try", amount: 1450 }],
        options: { Boy: value },
      })),
    },
  })
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { product: { id: string } }).product.id
}

const saveBar = (page: Page) => page.getByRole("region", { name: "Kaydedilmemiş değişiklikler" })

test.describe("stock tracking turned on later", () => {
  test("turns an untracked variant's tracking on with a count, then off keeping it", async ({
    page,
    guard,
  }) => {
    const location = await defaultLocation(page)
    test.skip(!location, "the shop has no default stock location")
    const id = await makeProduct(page)
    const stocked = async () => {
      const row = await variantOf(page, id, "12 cm")
      return {
        tracked: row?.manage_inventory,
        count: row?.inventory_items?.[0]?.inventory?.location_levels?.find(
          (level) => level.location_id === location
        )?.stocked_quantity,
      }
    }
    try {
      await page.goto(`/products/${id}`)
      await expect(pageHeading(page)).toBeVisible()
      const data = page.locator("#product-data")
      await data.getByRole("tab", { name: "Varyantlar" }).click()
      await expect(page.locator("[data-variant-row]")).toHaveCount(2)

      // On, with a count, saved by the page's save bar
      await page.getByRole("button", { name: /Boy: 12 cm/ }).click()
      const form = page.getByRole("form", { name: "Varyantı düzenle" })
      const tracking = form.getByRole("switch", { name: "Stok takibi" })
      await expect(tracking).not.toBeChecked()
      await expect(form.getByText("Stok takibi yok: bu varyant her zaman satılır.")).toBeVisible()
      await tracking.click()
      await form.getByLabel("Stok adedi").fill("7")
      await expect(saveBar(page)).toBeVisible()
      await saveBar(page).getByRole("button", { name: "Kaydet" }).click()
      await expect(saveBar(page)).toHaveCount(0)
      await expect.poll(stocked).toEqual({ tracked: true, count: 7 })

      // Read again from the server: the count is there
      await page.reload()
      await expect(pageHeading(page)).toBeVisible()
      await page.locator("#product-data").getByRole("tab", { name: "Varyantlar" }).click()
      await page.getByRole("button", { name: /Boy: 12 cm/ }).click()
      const again = page.getByRole("form", { name: "Varyantı düzenle" })
      await expect(again.getByRole("switch", { name: "Stok takibi" })).toBeChecked()
      await expect(again.getByLabel("Stok adedi")).toHaveValue("7")

      // Off: asked in place, the count kept on the server
      await again.getByRole("switch", { name: "Stok takibi" }).click()
      await expect(again.getByText(/Stok takibi kapatılsın mı\?/)).toBeVisible()
      await again.getByRole("button", { name: "Takibi kapat" }).click()
      await expect(again.getByRole("switch", { name: "Stok takibi" })).not.toBeChecked()
      await saveBar(page).getByRole("button", { name: "Kaydet" }).click()
      await expect(saveBar(page)).toHaveCount(0)
      await expect.poll(stocked).toEqual({ tracked: false, count: 7 })
      await guard.assertHealthy()
    } finally {
      // The draft goes as it came
      await page.request.delete(`/admin/products/${id}`)
    }
  })
})
