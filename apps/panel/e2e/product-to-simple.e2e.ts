import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * A product with variants made simple (docs/06 "Ürün sayfası", "Ürün
 * verileri"): "Basit ürün" asks in the card, the person keeps the second
 * variant, the other is deleted and the colour replaced by the wizard's
 * "Seçenek: Standart"; read again, the product is simple. The test makes its own draft product and deletes it
 * at the end: nothing of the shop's own changes.
 */

interface Stored {
  options: { id: string; title: string; values?: { value: string }[] }[]
  variants: {
    id: string
    title: string
    prices?: { amount: number; currency_code: string }[]
    options?: { value: string }[]
  }[]
}

const FIELDS =
  "id,options.id,options.title,options.values.value,variants.id,variants.title,variants.options.value,variants.prices.amount,variants.prices.currency_code"

async function stored(page: Page, id: string): Promise<Stored> {
  const answer = await page.request.get(`/admin/products/${id}?fields=${FIELDS}`)
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { product: Stored }).product
}

/** A draft of two colours, priced: never shown in the storefront. */
async function makeProduct(page: Page): Promise<string> {
  const answer = await page.request.post("/admin/products", {
    data: {
      title: "Deri Cüzdan",
      status: "draft",
      options: [{ title: "Renk", values: ["Taba", "Siyah"] }],
      variants: [
        { title: "Taba", amount: 650 },
        { title: "Siyah", amount: 690 },
      ].map(({ title, amount }, rank) => ({
        title,
        variant_rank: rank,
        manage_inventory: false,
        prices: [{ currency_code: "try", amount }],
        options: { Renk: title },
      })),
    },
  })
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { product: { id: string } }).product.id
}

test.describe("product made simple", () => {
  test("keeps the picked variant, deletes the other and takes the option off", async ({
    page,
    guard,
  }) => {
    const id = await makeProduct(page)
    try {
      await page.goto(`/products/${id}`)
      await expect(pageHeading(page)).toBeVisible()
      const data = page.locator("#product-data")
      const type = data.getByRole("combobox", { name: "Ürün tipi" })
      await expect(type).toHaveText("Varyantlı ürün")

      // "Basit ürün" asks in the card, no dialog
      await type.click()
      await page.getByRole("option", { name: "Basit ürün" }).click()
      const ask = data.getByRole("group", { name: "Basit ürüne geçilsin mi?" })
      await expect(ask).toBeVisible()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(ask).toContainText("diğer 1 varyant silinir")
      await ask.getByRole("radio", { name: /Siyah/ }).click()
      await ask.getByRole("button", { name: "1 varyantı sil ve basit ürüne geç" }).click()
      await expect(ask).toHaveCount(0)
      await expect(type).toHaveText("Basit ürün")

      await expect
        .poll(async () => {
          const product = await stored(page, id)
          return {
            // The wizard's placeholder, as a product made without options has
            options: product.options.map(
              (option) => `${option.title}: ${(option.values ?? []).map((v) => v.value).join(",")}`
            ),
            variants: product.variants.map((variant) => ({
              title: variant.title,
              values: (variant.options ?? []).map((value) => value.value),
            })),
          }
        })
        .toEqual({
          options: ["Seçenek: Standart"],
          variants: [{ title: "Siyah", values: ["Standart"] }],
        })
      const kept = (await stored(page, id)).variants[0]
      expect(kept?.prices?.find((price) => price.currency_code === "try")?.amount).toBe(690)

      // Read again, it stays simple: no Varyantlar tab
      await page.reload()
      await expect(pageHeading(page)).toBeVisible()
      await expect(type).toHaveText("Basit ürün")
      await expect(data.getByRole("tab", { name: "Varyantlar" })).toHaveCount(0)
      await guard.assertHealthy()
    } finally {
      // The draft goes as it came
      await page.request.delete(`/admin/products/${id}`)
    }
  })
})
