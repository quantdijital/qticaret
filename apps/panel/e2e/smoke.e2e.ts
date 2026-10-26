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
  // The search is in the address once it ran; the list then holds what it found
  await expect(page).toHaveURL(/[?&]q=/)
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

test("picks products and checks a bulk change without applying it", async ({ page, guard }) => {
  await page.goto("/products")
  const rows = page.getByRole("table").getByRole("checkbox")
  await expect(rows.nth(2)).toBeVisible()
  await rows.nth(1).check()
  await rows.nth(2).check()
  const bar = page.getByRole("region", { name: "Seçili ürünler" })
  await expect(bar.getByText("2 ürün seçildi")).toBeVisible()
  await bar.getByRole("button", { name: "Toplu düzenle" }).click()
  await page.getByRole("menuitem", { name: "Fiyatı değiştir" }).click()
  const dialog = page.getByRole("dialog", { name: "Fiyatı değiştir" })
  await dialog.getByRole("radio", { name: "Yüzde" }).check()
  await dialog.getByLabel("Oran (%)").fill("0")
  await dialog.getByRole("button", { name: "2 ürüne uygula" }).click()
  // Named on the field; nothing is sent
  await expect(dialog.getByRole("alert")).toHaveText(
    "Sıfırdan büyük, en fazla 1000 olan bir oran girin."
  )
  await dialog.getByLabel("Oran (%)").fill("10")
  await expect(dialog.getByText("Örnek: ₺100,00 → ₺110,00")).toBeVisible()
  await dialog.getByRole("button", { name: "Vazgeç" }).click()
  await expect(dialog).toBeHidden()
  await bar.getByRole("button", { name: "Seçimi kaldır" }).click()
  await expect(bar).toBeHidden()
  await guard.assertHealthy()
})
