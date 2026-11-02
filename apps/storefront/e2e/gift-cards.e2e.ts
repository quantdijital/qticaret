import { expect, test } from "@playwright/test"
import { collectErrors, dismissCookies } from "./support"

/**
 * A gift card's balance page (adr/0025 Ek 2026-11-03): there only while
 * the shop sells gift cards, never indexed; an unknown code says so. The
 * dev database has no gift card product, so the product form and the cart
 * line are the unit tests' and the theme's.
 */
test("the balance page answers an unknown code, or is not there while the shop sells none", async ({
  page,
}) => {
  const errors = collectErrors(page)
  const response = await page.goto("/hediye-karti/bakiye")
  if (response?.status() === 404) {
    test.info().annotations.push({ type: "note", description: "gift cards are off in this shop" })
    return
  }
  expect(response?.status()).toBe(200)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
  await dismissCookies(page)
  await page.getByLabel("Kart kodu").fill("QT-ZZZZ-ZZZZ-ZZZZ-ZZZZ")
  await page.getByRole("button", { name: "Bakiyeyi göster" }).click()
  // A proof of work may be asked first (past three tries): the browser solves it
  await expect(page.getByText("Bu koda ait hediye kartı bulunamadı.")).toBeVisible({
    timeout: 30_000,
  })
  // The code went in the body, never in the address
  expect(page.url()).not.toContain("ZZZZ")
  expect(errors).toEqual([])
})
