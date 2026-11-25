import { expect, test } from "./support/guard"

/**
 * The product list's WooCommerce-like tools (docs/06 "Ürünler"): the
 * stock code under the name, "Görünüm" (products per page and the
 * columns, kept per person), the row's ⋯ menu and the bulk bar's "Sil".
 * Nothing is written: the questions are answered "Vazgeç", the options
 * are put back.
 */

test("shows the stock code and keeps the person's page size and columns", async ({
  page,
  guard,
}) => {
  await page.goto("/products")
  const table = page.getByRole("table")
  await expect(table.getByRole("link").first()).toBeVisible()
  // The demo catalog's products carry stock codes, shown under their names
  await expect(table.getByTitle("Stok kodu (SKU)").first()).toBeVisible()
  await expect(table.getByRole("columnheader", { name: "Kategori" })).toBeAttached()

  await page.getByRole("button", { name: "Görünüm" }).click()
  await page.getByRole("menuitemradio", { name: "50 ürün" }).click()
  await page.getByRole("button", { name: "Görünüm" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Kategori" }).click()
  // The menu stays open while columns are ticked
  await expect(page.getByRole("menuitemcheckbox", { name: "Kategori" })).toHaveAttribute(
    "aria-checked",
    "false"
  )
  await page.keyboard.press("Escape")
  await expect(table.getByRole("columnheader", { name: "Kategori" })).toHaveCount(0)

  // Kept for this person across a reload
  await page.reload()
  await expect(table.getByRole("link").first()).toBeVisible()
  await expect(table.getByRole("columnheader", { name: "Kategori" })).toHaveCount(0)
  await page.getByRole("button", { name: "Görünüm" }).click()
  await expect(page.getByRole("menuitemradio", { name: "50 ürün" })).toHaveAttribute(
    "aria-checked",
    "true"
  )

  // Put back as it was
  await page.getByRole("menuitemcheckbox", { name: "Kategori" }).click()
  await page.getByRole("menuitemradio", { name: "20 ürün" }).click()
  await expect(table.getByRole("columnheader", { name: "Kategori" })).toBeAttached()
  await guard.assertHealthy()
})

test("offers a row's actions and asks before deleting", async ({ page, guard }) => {
  await page.goto("/products")
  const first = page.getByRole("table").getByRole("link").first()
  await expect(first).toBeVisible()
  const title = (await first.textContent()) ?? ""
  await page
    .getByRole("button", { name: `${title} işlemleri` })
    .first()
    .click()
  await expect(page.getByRole("menuitem", { name: /^(Vitrinde gör|Önizle)$/ })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: /^(Yayınla|Yayından kaldır)$/ })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Kopyala" })).toBeVisible()
  await page.getByRole("menuitem", { name: "Ürünü sil" }).click()
  const question = page.getByRole("alertdialog", { name: `${title} silinsin mi?` })
  await expect(question).toBeVisible()
  await question.getByRole("button", { name: "Vazgeç" }).click()
  await expect(question).toBeHidden()
  // The menu's clicks stay in the menu: still on the list
  await expect(page).toHaveURL(/\/products(\?|$)/)
  await guard.assertHealthy()
})

test("asks with the count before deleting picked products", async ({ page, guard }) => {
  await page.goto("/products")
  const boxes = page.getByRole("table").getByRole("checkbox")
  await expect(boxes.nth(2)).toBeVisible()
  await boxes.nth(1).check()
  await boxes.nth(2).check()
  const bar = page.getByRole("region", { name: "Seçili ürünler" })
  await bar.getByRole("button", { name: "Sil", exact: true }).click()
  const question = page.getByRole("alertdialog", { name: "2 ürün silinsin mi?" })
  await expect(question).toBeVisible()
  await expect(question.getByRole("button", { name: "2 ürünü sil" })).toBeVisible()
  await question.getByRole("button", { name: "Vazgeç" }).click()
  await expect(question).toBeHidden()
  await expect(bar.getByText("2 ürün seçildi")).toBeVisible()
  await guard.assertHealthy()
})
