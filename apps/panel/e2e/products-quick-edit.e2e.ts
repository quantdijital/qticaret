import { expect, pageHeading, test } from "./support/guard"

/**
 * The product list's quick edit (docs/06 "Ürünler"): "Hızlı düzenle"
 * turns the price, stock and status cells into fields; the header then
 * holds "N değişikliği kaydet" and "Vazgeç". One demo product's price is
 * changed and saved, then put back the same way.
 */

test("edits a price in the list, saves it from the header and puts it back", async ({
  page,
  guard,
}) => {
  await page.goto("/products")
  await expect(page.getByRole("table").getByRole("link").first()).toBeVisible()
  await page.getByRole("button", { name: "Hızlı düzenle" }).click()

  // The first product of one variant: its price is a field
  const price = page.getByRole("textbox", { name: / fiyatı$/ }).first()
  await expect(price).toBeVisible()
  const label = (await price.getAttribute("aria-label")) ?? ""
  const field = page.getByRole("textbox", { name: label, exact: true })
  const original = await field.inputValue()
  const save = page.getByRole("button", { name: "1 değişikliği kaydet" })

  // Typed, then let go: nothing is sent, the field shows what is stored
  await field.fill("1,23")
  await expect(save).toBeVisible()
  await page.getByRole("button", { name: "Vazgeç" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Değişikliklerden vazgeç" })
    .click()
  await expect(save).toBeHidden()
  await expect(field).toHaveValue(original)

  // A price that cannot be saved holds the save back
  await field.fill("0")
  await expect(save).toBeDisabled()

  // Saved from the header, then put back
  await field.fill("1,23")
  await save.click()
  await expect(page.getByText("1 ürün güncellendi.")).toBeVisible()
  await expect(save).toBeHidden()
  await expect(field).toHaveValue("1,23")
  await field.fill(original)
  await page.getByRole("button", { name: "1 değişikliği kaydet" }).click()
  await expect(page.getByRole("button", { name: "1 değişikliği kaydet" })).toBeHidden()
  await expect(field).toHaveValue(original)
  await expect(pageHeading(page)).toHaveText("Ürünler")
  await guard.assertHealthy()
})
