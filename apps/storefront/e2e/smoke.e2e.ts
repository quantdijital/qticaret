import { expect, test } from "@playwright/test"
import { collectErrors, DEMO_PRODUCT, dismissCookies } from "./support"

const PAGES = [
  "/",
  DEMO_PRODUCT,
  "/sepet",
  "/blog",
  "/magaza",
  "/magaza?sirala=fiyat-artan",
  "/yorumlar",
  "/arama?q=gomlek",
  "/hesap/giris",
  "/hesap/kayit",
  "/hesap/sifre-sifirla",
  "/siparis",
]

test.describe("storefront pages", () => {
  for (const path of PAGES) {
    test(`${path} opens without errors`, async ({ page }) => {
      const errors = collectErrors(page)
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      await expect(page.locator("h1").first()).toBeVisible()
      expect(errors).toEqual([])
    })
  }

  test("a forged or malformed preview link is a 404, never indexed", async ({ page }) => {
    const forged = await page.goto(
      "/onizleme/cnt_01ABCDEFGHJK.zzzzzz.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    )
    expect(forged?.status()).toBe(404)
    expect((await page.goto("/onizleme/bir-sey"))?.status()).toBe(404)
  })

  test("the footer offers the newsletter, with what subscribing consents to", async ({ page }) => {
    await page.goto("/")
    const box = page.locator("#bulten").locator("..")
    await expect(box.getByRole("textbox", { name: "E-posta adresiniz" })).toBeVisible()
    await expect(box.getByText(/ticari elektronik ileti/)).toBeVisible()
  })

  test("an unknown address is a 404 page", async ({ page }) => {
    const response = await page.goto("/bu-sayfa-yok-12345")
    expect(response?.status()).toBe(404)
  })

  test("every page carries its security headers and a nonce'd CSP", async ({ page }) => {
    const response = await page.goto("/")
    const headers = response?.headers() ?? {}
    expect(headers["x-content-type-options"]).toBe("nosniff")
    expect(headers["x-frame-options"]).toBe("DENY")
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin")
    const csp = headers["content-security-policy"] ?? ""
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
  })

  test("the account pages send a guest to sign in", async ({ page }) => {
    await page.goto("/hesap/siparisler")
    await expect(page).toHaveURL(/\/hesap\/giris\?sonra=%2Fhesap%2Fsiparisler/)
  })

  test("the cookie banner takes an answer and stays away", async ({ page }) => {
    await page.goto("/")
    await dismissCookies(page)
    await page.reload()
    await expect(page.locator("#cerez-baslik")).toHaveCount(0)
  })
})
