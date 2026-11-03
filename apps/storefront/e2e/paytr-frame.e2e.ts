import { expect, test } from "@playwright/test"
import { purchasePath, stockedProduct } from "./catalog"
import { PAYTR_CARDS, ensureFakePaytr, payWithTestCard, startCardPayment } from "./paytr"
import { addressAndShipping, dismissCookies } from "./support"

/**
 * A card the bank refuses, in the local PayTR's frame (`pnpm dev:paytr`,
 * its README's refused card): the form takes it, the bank's 3-D Secure
 * page asks its code, and the bank's no brings the shopper to the
 * storefront's failure page (`/odeme/sonuc/hata` → `/odeme/durum?d=hata`)
 * with the cart kept to try again. No order is made. A paid card is the
 * payment link test's (`payment-link-flow.e2e.ts`).
 */
test("a refused card ends on the failure page, the cart kept", async ({ page }) => {
  // Connecting PayTR, if the shop has none, takes a temporary owner (Medusa's CLI, seconds each)
  test.setTimeout(120_000)
  await ensureFakePaytr()
  await page.goto(purchasePath(await stockedProduct()))
  await dismissCookies(page)
  await page.locator("main form button[type=submit]").filter({ hasText: "Sepete ekle" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByRole("dialog").getByRole("link", { name: "Ödemeye geç" }).click()
  await expect(page).toHaveURL(/\/odeme/)
  await addressAndShipping(page, {
    email: `e2e-${String(Date.now())}@quantdijital.com`,
    first_name: "Uçtan",
    last_name: "Uca",
    phone: "05321234567",
  })

  await startCardPayment(page)
  await payWithTestCard(page, { number: PAYTR_CARDS.refused })

  await expect(page).toHaveURL(/\/odeme\/durum\?d=hata$/, { timeout: 30_000 })
  await expect(page.locator("h1")).toHaveText("Ödeme alınamadı")
  await expect(
    page.getByText(
      "Kartınızdan ücret alınmadı. Sepetiniz duruyor; tekrar deneyebilir ya da başka bir yöntem seçebilirsiniz."
    )
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Ödeme adımına dön" })).toHaveAttribute(
    "href",
    "/odeme"
  )
  // The cart is still there, its line to pay for again
  await page.goto("/sepet")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sepetim")
  await expect(page.getByRole("button", { name: /ürününü sepetten kaldır$/ })).toHaveCount(1)
})
