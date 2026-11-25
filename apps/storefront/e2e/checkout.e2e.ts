import { expect, test } from "@playwright/test"
import { purchasePath, stockedProduct } from "./catalog"
import { addressAndShipping, addToCart, dismissCookies, mainButton } from "./support"

/**
 * A guest buys by bank transfer (D7): product → cart drawer → checkout's
 * three steps → the order page with the account to pay to. The product is
 * one in stock the shop sells (`catalog.ts`), its variant chosen; the
 * address is the first one the shop's address data offers.
 */
test("a guest orders by bank transfer", async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto(purchasePath(await stockedProduct()))
  await dismissCookies(page)
  await addToCart(page)
  await page.getByRole("dialog").getByRole("link", { name: "Ödemeye geç" }).click()

  await expect(page).toHaveURL(/\/odeme/)
  await addressAndShipping(page, {
    email: `e2e-${String(Date.now())}@quantdijital.com`,
    first_name: "Uçtan",
    last_name: "Uca",
    phone: "05321234567",
  })

  await page.locator('input[value="pp_bank-transfer_bank-transfer"]').check()
  // The optional note for the shop rides with the order (Batch 8 / O1)
  await page.getByLabel("Sipariş notu (isteğe bağlı)").fill("Zili çalmayın, kapıya bırakın.")
  const accept = page.locator('input[name="accept"]')
  if (await accept.count()) {
    await accept.check()
  }
  await mainButton(page, "Siparişi tamamla").click()

  await expect(page).toHaveURL(/\/siparis\/order_[0-9A-Z]+\?token=.+&yeni=1/, { timeout: 30_000 })
  await expect(page.locator("h1")).toHaveText("Teşekkürler, siparişiniz alındı")
  await expect(page.getByText("IBAN")).toBeVisible()
  // The cart is gone with the order
  await page.goto("/sepet")
  await expect(page.getByText("Sepetiniz boş.")).toBeVisible()
})
