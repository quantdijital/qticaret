import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { collectErrors, cookieBanner, dismissCookies } from "./support"

const robotsOf = (page: Page) => page.locator('meta[name="robots"]').getAttribute("content")

// Well shaped, but no token the backend made
const FORGED_UNSUBSCRIBE = `${"0".repeat(64)}.${"A".repeat(43)}`
const UNKNOWN_TOKEN = "Zx_9-".repeat(8) + "abc"

test.describe("cookie preferences (D9)", () => {
  test("the footer's link opens the banner again, the answer in force ticked", async ({ page }) => {
    const errors = collectErrors(page)
    // Any page has the banner and the footer; the cart's needs the least of the backend
    await page.goto("/sepet")
    const banner = cookieBanner(page)
    await expect(banner).toBeVisible()
    // Analytics only, from the choices
    await banner.getByText("Tercihleri seç").click()
    await banner.getByLabel(/Analitik çerezler/).check()
    await banner.getByRole("button", { name: "Seçimimi kaydet" }).click()
    await expect(banner).toBeHidden()
    await page.waitForLoadState("networkidle")
    await page.reload()
    await expect(banner).toBeHidden()

    await page.getByRole("contentinfo").getByRole("link", { name: "Çerez tercihleri" }).click()
    await expect(banner).toBeVisible()
    await expect(page).toHaveURL(/\/sepet$/)
    await expect(banner.getByLabel(/Analitik çerezler/)).toBeChecked()
    await expect(banner.getByLabel(/Pazarlama çerezleri/)).not.toBeChecked()

    // Escape leaves it as it was; "only necessary" changes the answer
    await page.keyboard.press("Escape")
    await expect(banner).toBeHidden()
    await page.getByRole("contentinfo").getByRole("link", { name: "Çerez tercihleri" }).click()
    await banner.getByRole("button", { name: "Yalnızca zorunlu" }).click()
    await expect(banner).toBeHidden()
    await page.waitForLoadState("networkidle")
    await page.reload()
    await page.getByRole("contentinfo").getByRole("link", { name: "Çerez tercihleri" }).click()
    await expect(banner.getByLabel(/Analitik çerezler/)).not.toBeChecked()
    expect(errors).toEqual([])
  })

  test("/cerez-tercihleri asks the same on its own page, noindex", async ({ page }) => {
    const response = await page.goto("/cerez-tercihleri")
    expect(response?.status()).toBe(200)
    expect(await robotsOf(page)).toMatch(/noindex/)
    await expect(page.getByRole("heading", { level: 1, name: "Çerez tercihleri" })).toBeVisible()
    // The page asks here: the banner waits
    await expect(cookieBanner(page)).toBeHidden()
  })

  test("without script the link leads to the page, which saves and says so", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto("/sepet")
    // The banner answers without script too, and then waits closed
    await cookieBanner(page).getByRole("button", { name: "Yalnızca zorunlu" }).click()
    await expect(cookieBanner(page)).toBeHidden()
    await page.getByRole("contentinfo").getByRole("link", { name: "Çerez tercihleri" }).click()
    await expect(page).toHaveURL(/\/cerez-tercihleri$/)
    const main = page.getByRole("main")
    await main.getByLabel(/Pazarlama çerezleri/).check()
    await main.getByRole("button", { name: "Seçimimi kaydet" }).click()
    await expect(page).toHaveURL(/\/cerez-tercihleri\?kaydedildi=1$/)
    await expect(page.getByRole("status")).toContainText("kaydedildi")
    await expect(main.getByLabel(/Pazarlama çerezleri/)).toBeChecked()
    await expect(main.getByLabel(/Analitik çerezler/)).not.toBeChecked()
    await context.close()
  })
})

test.describe("a message's token links (adr/0038 Ek 2026-11-02)", () => {
  const PAGES = ["/abonelik/cik", "/abonelik/onay", "/stok-bildirimi/onay"]

  for (const path of PAGES) {
    test(`${path} says a broken link is broken: 200, noindex, never an error`, async ({ page }) => {
      const errors = collectErrors(page)
      for (const query of ["?t=bozuk", "", "?t=%3Cscript%3E", "?sonuc=baska"]) {
        const response = await page.goto(`${path}${query}`)
        expect(response?.status()).toBe(200)
        expect(response?.headers()["referrer-policy"]).toBe("no-referrer")
        expect(await robotsOf(page)).toMatch(/^noindex,\s*nofollow$/)
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bağlantı geçersiz")
        await expect(page.locator("main form")).toHaveCount(0)
      }
      expect(errors).toEqual([])
    })
  }

  test("asks before acting, and a forged token withdraws nothing", async ({ page }) => {
    await page.goto(`/abonelik/cik?t=${FORGED_UNSUBSCRIBE}`)
    await dismissCookies(page)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Kampanya e-postalarından çıkın"
    )
    await page.getByRole("button", { name: "Çıkışı onayla" }).click()
    await expect(page).toHaveURL(/\/abonelik\/cik\?sonuc=gecersiz$/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bağlantı geçersiz")
  })

  test("an unknown consent or stock alert token is refused by the backend, said plainly", async ({
    page,
  }) => {
    await page.goto(`/abonelik/onay?t=${UNKNOWN_TOKEN}`)
    await dismissCookies(page)
    await page.getByRole("button", { name: "Onayla" }).click()
    await expect(page).toHaveURL(/\/abonelik\/onay\?sonuc=gecersiz$/)
    await expect(page.getByText(/kullanılmış ya da süresi dolmuş/)).toBeVisible()

    await page.goto(`/stok-bildirimi/onay?t=${UNKNOWN_TOKEN}`)
    await page.getByRole("button", { name: "Bildirimi onayla" }).click()
    await expect(page).toHaveURL(/\/stok-bildirimi\/onay\?sonuc=gecersiz$/)
    await expect(page.getByText(/Ürün sayfasından yeniden/)).toBeVisible()
  })
})
