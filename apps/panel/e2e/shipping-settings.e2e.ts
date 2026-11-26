import { expect, test } from "./support/guard"

/**
 * Settings > Shipping, as simple as WooCommerce's (the owner, 2026-11-26):
 * an option opens in its own row, no dialog; what is set once is folded
 * under "Gelişmiş" to a line each; the carriers' invoice details are on
 * the carriers' pages, and the invoices page's old address leads there.
 * Nothing is saved.
 */
test.describe("shipping settings", () => {
  test("opens an option in its row and folds the rarely used parts", async ({ page, guard }) => {
    await page.goto("/settings/shipping?part=options")
    const options = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Kargo seçenekleri" }),
    })
    const row = options.getByRole("button", { name: /seçeneğini düzenle$/ }).first()
    if ((await row.count()) > 0) {
      await row.click()
      await expect(row).toHaveAttribute("aria-expanded", "true")
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(options.getByLabel(/^Ad/).first()).toBeVisible()
      await options.getByRole("button", { name: "Vazgeç" }).click()
      await expect(row).toHaveAttribute("aria-expanded", "false")
    }
    const advanced = page.getByRole("region", { name: "Gelişmiş" })
    for (const name of ["Teslim süresi", "Ücret tablosu", "Varsayılan paket", "Kargo etiketi"]) {
      await expect(advanced.getByRole("button", { name })).toBeVisible()
    }
    await expect(advanced.getByText(/^Kargoya verme \d/)).toBeVisible()
    await guard.assertHealthy()
  })

  test("keeps the carriers' invoice details with the carriers", async ({ page, guard }) => {
    await page.goto("/settings/einvoice?part=carriers")
    await expect(page).toHaveURL(/\/settings\/shipping\?part=carriers$/)
    await expect(page.getByText("Kargo hizmetleri")).toBeVisible()
    await page.goto("/settings/shipping/aras")
    await expect(page.getByText("Faturadaki firma bilgisi")).toBeVisible()
    await expect(page.getByLabel("VKN")).toBeVisible()
    await guard.assertHealthy()
  })
})
