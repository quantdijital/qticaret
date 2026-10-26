import { expect, pageHeading, test } from "./support/guard"

/** The sidebar's sections (src/components/layout/navigation.ts) and the settings pages. */
const SECTIONS = [
  "/",
  "/orders",
  "/customers",
  "/products",
  "/categories",
  "/brands",
  "/inventory",
  "/promotions",
  "/content",
  "/seo",
  "/reports",
]
const SETTINGS = [
  "/settings/store",
  "/settings/appearance",
  "/settings/locations",
  "/settings/seo",
  "/settings/attributes",
  "/settings/features",
  "/settings/jobs",
  "/settings/audit",
]

/** Docs/06's smoke test: every screen a shop uses opens, with no error, script or server. */
test("opens every main section without an error", async ({ page, guard }) => {
  for (const path of SECTIONS) {
    await test.step(path, async () => {
      await page.goto(path)
      await expect(pageHeading(page)).toBeVisible()
      await page.waitForLoadState("networkidle")
      await guard.assertHealthy()
    })
  }
})

test("opens every settings page without an error", async ({ page, guard }) => {
  for (const path of SETTINGS) {
    await test.step(path, async () => {
      await page.goto(path)
      await expect(pageHeading(page)).toBeVisible()
      await page.waitForLoadState("networkidle")
      await guard.assertHealthy()
    })
  }
})

test("finds a product by its name and opens it", async ({ page, guard }) => {
  await page.goto("/products")
  const first = page.getByRole("table").getByRole("link").first()
  await expect(first).toBeVisible()
  const title = (await first.textContent()) ?? ""
  await page.getByRole("searchbox", { name: "Ürün adı ya da stok kodu ile ara" }).fill(title)
  await expect(page.getByRole("table").getByRole("link", { name: title }).first()).toBeVisible()
  await page.getByRole("table").getByRole("link", { name: title }).first().click()
  await expect(pageHeading(page)).toHaveText(title)
  await guard.assertHealthy()
})

test("checks a product sheet without writing it", async ({ page, guard }) => {
  await page.goto("/products")
  await page.getByRole("button", { name: "İçe aktar" }).click()
  const dialog = page.getByRole("dialog", { name: "Ürünleri içe aktar" })
  await expect(dialog).toBeVisible()
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "urunler.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      `Tanıtıcı;Ürün adı;Fiyat (TRY)\ne2e-kontrol-${String(Date.now())};E2E Kontrol;99,90\n`
    ),
  })
  await dialog.getByRole("button", { name: "Kontrol et" }).click()
  await expect(dialog.getByText("1 ürün eklenecek, 0 ürün güncellenecek.")).toBeVisible({
    timeout: 30_000,
  })
  // A check writes nothing: closing leaves the catalog as it was
  await dialog.getByRole("button", { name: "Vazgeç" }).click()
  await expect(dialog).toBeHidden()
  await guard.assertHealthy()
})
