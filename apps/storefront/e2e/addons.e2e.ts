import { expect, test } from "@playwright/test"
import { collectErrors, DEMO_PRODUCT, dismissCookies } from "./support"

/**
 * Product add-ons (adr/0052): the dev shop has the `catalog.addons` flag
 * off and its demo product has none, so the add-ons route answers 404 and
 * the page reads that as "no add-ons": no picks form, and the cart form
 * adds as always. The picks, their prices, the cart's edit form and the
 * checkout's refusals are the unit tests' (the flow cannot be seen here
 * without add-ons in the dev database).
 */
test("a product without add-ons asks none and still goes into the cart", async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(DEMO_PRODUCT)
  await dismissCookies(page)
  await expect(page.locator('main [name^="addon_"]')).toHaveCount(0)
  await expect(page.locator('main input[name="product_id"]')).toHaveCount(0)
  const size = page.locator('main input[type=radio][name^="option_"]').first()
  await size.check({ force: true })
  await page.locator("main form button[type=submit]").filter({ hasText: "Sepete ekle" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()

  await page.goto("/sepet")
  await expect(page.locator("main h1")).toHaveText("Sepetim")
  // A plain line: no picks under it, no picks form
  await expect(page.locator('main form [name^="addon_"]')).toHaveCount(0)
  await expect(page.getByText("Seçenek ekle")).toHaveCount(0)
  expect(errors).toEqual([])
})
