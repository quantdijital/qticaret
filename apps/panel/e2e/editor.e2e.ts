import { expect, pageHeading, test } from "./support/guard"

/**
 * The theme editor (adr/0049) opens from the menu, full screen, with the
 * storefront's draft in its frame. Read only: nothing is changed, so
 * nothing is saved (a shop that never saved its design saves the default
 * one on first open, which changes nothing it shows).
 */
test("opens the theme editor with the draft in the preview and a section's settings", async ({
  page,
  guard,
}) => {
  await page.goto("/storefront/menus")
  await page
    .getByRole("navigation", { name: "Ana menü" })
    .getByRole("link", { name: "Tema düzenleyici" })
    .click()
  await expect(page).toHaveURL(/\/storefront\/editor$/)
  await expect(pageHeading(page)).toHaveText("Tema düzenleyici")
  // Full screen: the panel's own menu is not there
  await expect(page.getByRole("navigation", { name: "Ana menü" })).toHaveCount(0)

  const tree = page.getByRole("navigation", { name: "Sayfanın bölümleri" })
  await expect(tree.getByRole("heading", { name: "Ana sayfa" })).toBeVisible()
  const frame = page.locator("iframe[data-storefront-preview]")
  await expect(frame).toHaveAttribute("src", /\/onizleme\/sfl_/)
  // The storefront allows the panel to frame its preview page: the draft's page shows inside
  await expect(page.frameLocator("iframe[data-storefront-preview]").locator("body")).toBeVisible({
    timeout: 30_000,
  })

  await tree.getByRole("button", { name: "Tema ayarları" }).click()
  await expect(page.getByRole("heading", { name: "Tema ayarları" })).toBeVisible()
  await page.getByRole("button", { name: "Bölümlere dön" }).click()
  await expect(tree).toBeVisible()

  await page.getByRole("button", { name: "Sürümler" }).click()
  await expect(page.getByRole("dialog", { name: "Yayınlanan sürümler" })).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "Çık" }).click()
  await expect(page).toHaveURL(/\/storefront\/menus$/)
  await guard.assertHealthy()
})
