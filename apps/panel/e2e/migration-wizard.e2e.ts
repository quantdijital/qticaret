import { expect, test } from "./support/guard"

/**
 * Settings > Migration in three parts and the new migration's wizard
 * (adr/0042 Ek 2026-11-27): what moved, the completions, the steps after;
 * the wizard asks one thing a step and refuses to read a feed without its
 * address. Nothing is sent: no preview, no transfer.
 */
test.describe("migration", () => {
  test("shows the three parts and walks the wizard's first steps", async ({ page, guard }) => {
    await page.goto("/settings/migration")
    await expect(page.getByRole("heading", { name: "Taşınanlar" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Tamamlama işlemleri" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Taşımadan sonra" })).toBeVisible()
    await expect(page.getByText("Yeni eklenen ürünleri ve yazıları getir")).toBeVisible()

    await page.getByRole("link", { name: "Yeni taşıma" }).first().click()
    await expect(page).toHaveURL(/\/settings\/migration\/new$/)
    await expect(page.getByRole("heading", { name: "Kaynak" })).toBeVisible()
    await page.getByRole("radio", { name: /Başka platform/ }).click()
    await page.getByRole("button", { name: "İleri" }).click()
    await expect(page.getByLabel("Akış adresi")).toHaveAttribute(
      "placeholder",
      "https://eski-magaza.com/xml/google.xml"
    )
    await page.getByRole("button", { name: "İncele" }).click()
    await expect(page.getByText("Akış adresini girin.")).toBeVisible()
    await page.getByRole("button", { name: "Geri" }).click()
    await expect(page.getByRole("radio", { name: /Başka platform/ })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    await guard.assertHealthy()
  })

  test("keeps the old addresses on their own page", async ({ page, guard }) => {
    await page.goto("/settings/migration/addresses")
    await expect(
      page.getByRole("heading", { name: "Eski adresler ve yönlendirmeler" })
    ).toBeVisible()
    await guard.assertHealthy()
  })
})
