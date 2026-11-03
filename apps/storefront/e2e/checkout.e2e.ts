import { expect, test } from "@playwright/test"
import { purchasePath, stockedProduct } from "./catalog"
import { dismissCookies } from "./support"

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
  await page.locator("main form button[type=submit]").filter({ hasText: "Sepete ekle" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByRole("dialog").getByRole("link", { name: "Ödemeye geç" }).click()

  await expect(page).toHaveURL(/\/odeme/)
  await page.fill("#email", `e2e-${String(Date.now())}@quantdijital.com`)
  await page.fill("#first_name", "Uçtan")
  await page.fill("#last_name", "Uca")
  await page.fill("#phone", "05321234567")
  await page.selectOption("#province", { index: 1 })
  await expect(page.locator("#district option")).not.toHaveCount(1)
  await page.selectOption("#district", { index: 1 })
  await expect(page.locator("#neighborhood option")).not.toHaveCount(1)
  await page.selectOption("#neighborhood", { index: 1 })
  await page.fill("#address_1", "Deneme Sokak No: 1")
  await page.locator("main form button[type=submit]").click()

  await expect(page).toHaveURL(/adim=kargo/)
  await page.locator("main form button[type=submit]").click()
  await expect(page).toHaveURL(/\/odeme$/)

  await page.locator('input[value="pp_bank-transfer_bank-transfer"]').check()
  const accept = page.locator('input[name="accept"]')
  if (await accept.count()) {
    await accept.check()
  }
  await page
    .locator("main form button[type=submit]")
    .filter({ hasText: "Siparişi tamamla" })
    .click()

  await expect(page).toHaveURL(/\/siparis\/order_[0-9A-Z]+\?token=.+&yeni=1/, { timeout: 30_000 })
  await expect(page.locator("h1")).toHaveText("Teşekkürler, siparişiniz alındı")
  await expect(page.getByText("IBAN")).toBeVisible()
  // The cart is gone with the order
  await page.goto("/sepet")
  await expect(page.getByText("Sepetiniz boş.")).toBeVisible()
})
