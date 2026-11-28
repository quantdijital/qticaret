import type { Page } from "@playwright/test"
import { seriousIssues } from "./support/axe"
import { expect, pageHeading, test } from "./support/guard"
import { e2eSlug, removeE2eShop } from "./support/shops"
import { proveStepUp } from "./support/step-up"

/**
 * The new shop wizard and the shop's "Kurulum" tab (C11) against the real
 * control plane. The first test writes nothing. The second sets a real
 * shop up through the panel (the control plane's local provisioner: a
 * database, a migrated and started shop backend on 9200+) until it is
 * `active` on the knife pack (C12: its attributes, categories, flags and SEO
 * template applied in the shop), applies the pack again (nothing added),
 * stops it from the tab, and removes it with everything its setup made
 * (support/shops.ts; the teardown sweeps again).
 */

const next = (page: Page) => page.getByRole("button", { name: "İleri" }).click()
const stepHeading = (page: Page, name: string) =>
  page.getByRole("heading", { name, level: 2, exact: true })

test("walks the wizard: says what is missing, keeps what was typed, asks before leaving", async ({
  page,
  guard,
}) => {
  await page.goto("/tenants")
  await page.getByRole("link", { name: "Yeni mağaza" }).click()
  await expect(pageHeading(page)).toHaveText("Yeni mağaza")

  await next(page)
  await expect(page.getByText("Mağaza adını yazın.")).toBeVisible()
  await page.getByLabel("Mağaza adı").fill("Kalem Atölyesi")
  await page.getByLabel("Vergi kimlik no").fill("1234567891")
  await next(page)
  await expect(page.getByText(/Vergi kimlik no geçerli değil/)).toBeVisible()
  await page.getByLabel("Vergi kimlik no").fill("1234567890")
  await next(page)

  await expect(stepHeading(page, "Yetkililer")).toBeVisible()
  await expect(page.getByText(/sahip daveti bu e-posta adresine/)).toBeVisible()
  await page.getByLabel("Ad soyad").fill("Ayşe Demir")
  await page.getByRole("button", { name: "Geri" }).click()
  await expect(page.getByLabel("Mağaza adı")).toHaveValue("Kalem Atölyesi")
  await next(page)
  await expect(page.getByLabel("Ad soyad")).toHaveValue("Ayşe Demir")
  await page.getByLabel("E-posta").fill("ayse.demir@kalematolyesi.com")
  await next(page)

  await expect(stepHeading(page, "Paket")).toBeVisible()
  await next(page)
  await expect(page.getByText("Bir paket seçin.")).toBeVisible()
  const packages = page.getByRole("radio")
  test.skip((await packages.count()) === 0, "no package on sale on this machine")
  await packages.first().click()
  await next(page)

  await expect(page.getByLabel("Platform adresi")).toHaveValue("kalem-atolyesi")
  await page.getByLabel("Platform adresi").fill("www")
  await expect(page.getByText("Bu adres platforma ayrılmış; başka bir ad seçin.")).toBeVisible()
  await page.getByLabel("Platform adresi").fill(e2eSlug())
  await expect(page.getByText("Bu adres kullanılabilir.")).toBeVisible()
  await next(page)
  // C12: the packs the control plane has, the general one chosen, each one offered
  await expect(page.getByRole("radio", { name: /^Genel/ })).toBeChecked()
  const knives = page.getByRole("radio", { name: /^Bıçak ve çatal-bıçak/ })
  await expect(knives).toBeEnabled()
  await expect(
    page.getByText(/2 özellik şablonu · 31 özellik · 16 önerilen kategori/)
  ).toBeVisible()
  // No pack is "coming soon" any more (the menu's own badges aside)
  await expect(page.getByRole("main").getByText("Yakında")).toHaveCount(0)
  await knives.click()
  await next(page)
  // adr/0063 task 2.7: the pack's looks with their pictures, its first chosen
  await expect(stepHeading(page, "Hazır görünüm")).toBeVisible()
  await expect(page.getByRole("radio").first()).toBeChecked()
  await next(page)
  await expect(stepHeading(page, "Özet ve kur")).toBeVisible()
  await expect(page.getByText("Bıçak ve çatal-bıçak")).toBeVisible()
  await expect(page.getByText("Fatura bilgileri eksik")).toBeVisible()

  // Typed and not kept: leaving asks first; staying keeps the wizard
  await page.getByRole("link", { name: "Mağazalar" }).first().click()
  const leave = page.getByRole("alertdialog", { name: "Kaydedilmemiş değişiklikler var" })
  await expect(leave).toBeVisible()
  await leave.getByRole("button", { name: "Vazgeç" }).click()
  await expect(stepHeading(page, "Özet ve kur")).toBeVisible()
  await guard.assertHealthy()
})

test("@real sets a shop up through the panel until it is active, then stops it", async ({
  page,
  guard,
}, info) => {
  test.setTimeout(6 * 60_000)
  const slug = e2eSlug()
  try {
    await page.goto("/tenants/new")
    await page.getByLabel("Mağaza adı").fill("Kalem Atölyesi")
    await page.getByLabel("Unvan").fill("Kalem Atölyesi Kırtasiye Ltd. Şti.")
    await page.getByLabel("Vergi dairesi").fill("Kadıköy")
    await page.getByLabel("Vergi kimlik no").fill("1234567890")
    await page.getByLabel("Açık adres").fill("Moda Cad. No: 12")
    await page.getByLabel("İlçe").fill("Kadıköy")
    await page.getByLabel("İl", { exact: true }).fill("İstanbul")
    await page.getByLabel("Posta kodu").fill("34710")
    await next(page)
    await page.getByLabel("Ad soyad").fill("Ayşe Demir")
    await page.getByLabel("E-posta").fill(`ayse.demir+${slug}@kalematolyesi.com`)
    await page.getByLabel("Telefon").fill("0532 123 45 67")
    await next(page)
    const packages = page.getByRole("radio")
    await expect(packages.first()).toBeVisible()
    await packages.first().click()
    await next(page)
    await page.getByLabel("Platform adresi").fill(slug)
    await expect(page.getByText("Bu adres kullanılabilir.")).toBeVisible()
    await next(page)
    await page.getByRole("radio", { name: /^Bıçak ve çatal-bıçak/ }).click()
    await next(page)
    await expect(stepHeading(page, "Hazır görünüm")).toBeVisible()
    await next(page)
    await page.getByRole("button", { name: "Kur", exact: true }).click()
    await proveStepUp(page)

    // The shop's page, on its setup tab, the steps live
    await page.waitForURL(/\/tenants\/ten_[^/?]+\?part=setup/)
    await expect(pageHeading(page)).toHaveText("Kalem Atölyesi")
    await expect(page.getByRole("tab", { name: "Kurulum", selected: true })).toBeVisible()
    const actions = page.locator("section", {
      has: page.getByRole("heading", { name: "İşlemler" }),
    })
    test.skip(
      await page.getByText("Bu ortamda kurulum yapılmıyor.").isVisible(),
      "this control plane has no provisioner"
    )
    await expect(page.getByText("Etkin", { exact: true }).first()).toBeVisible({
      timeout: 4 * 60_000,
    })
    const steps = page.getByRole("list", { name: "Kurulum adımları" })
    await expect(steps.getByText("Etkinleştirme")).toBeVisible()
    await expect(steps.getByText(/^Port 92\d\d$/).first()).toBeVisible()
    await expect(page.getByRole("link", { name: /^http:\/\/localhost:102\d\d$/ })).toBeVisible()
    await expect(actions.getByRole("button", { name: "Yeniden dene" })).toBeDisabled()
    // C12: the pack applied in the shop, every item of it new there
    await expect(steps.getByText("52 öğe eklendi")).toBeVisible()
    const pack = page.locator("section", {
      has: page.getByRole("heading", { name: "Sektör paketi" }),
    })
    await expect(pack.getByText("Bıçak ve çatal-bıçak")).toBeVisible()
    await expect(pack.getByText("Sürüm 1")).toBeVisible()
    // Again (the proof still held): a run of its own that adds nothing
    await pack.getByRole("button", { name: "Paketi yeniden uygula" }).click()
    await expect(steps.getByText("0 öğe eklendi")).toBeVisible({ timeout: 2 * 60_000 })
    await expect(actions.getByRole("button", { name: "Durdur" })).toBeEnabled()

    // Stopped from the tab: asked first, the proof still held (no second code)
    await actions.getByRole("button", { name: "Durdur" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Durdur" }).click()
    await expect(actions.getByText("Son bilinen durum: mağaza sunucusu durduruldu.")).toBeVisible({
      timeout: 60_000,
    })
    await expect(actions.getByRole("button", { name: "Başlat" })).toBeEnabled()
    await guard.assertHealthy()

    // The tab with its recorded runs, light and dark, at a desk and a phone's
    // width, each from a fresh load (no colour caught mid-transition)
    for (const size of [
      { width: 1440, height: 900 },
      { width: 412, height: 915 },
    ]) {
      await page.setViewportSize(size)
      for (const mode of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: mode })
        await page.reload()
        await expect(page.getByRole("list", { name: "Kurulum adımları" })).toBeVisible()
        await page.waitForLoadState("networkidle")
        expect(await seriousIssues(page), `${mode} ${String(size.width)}`).toEqual([])
      }
    }
    info.annotations.push({ type: "shop", description: slug })
  } finally {
    removeE2eShop(slug)
  }
})
