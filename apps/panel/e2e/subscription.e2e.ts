import { expect, pageHeading, test } from "./support/guard"

/**
 * adr/0061 Ek C14: Settings > Abonelik, read only. The e2e backend runs
 * without a control plane (development): the page says the package is not
 * linked yet and shows the usage tiles, every one unlimited, read only. The managed page
 * (package card, payment, bars) is covered by the panel's unit tests.
 */
test("opens Settings > Abonelik from the settings menu, read only", async ({ page, guard }) => {
  await page.goto("/settings")
  // The settings home's own card (its line on what the section holds); the side menu's
  // link of the same name sat under the app's sidebar after Playwright scrolled it into
  // view on a CI runner, and the sidebar took the click
  await page.getByRole("link", { name: /^Abonelik\s+Paketiniz/ }).click()
  await page.waitForURL("**/settings/subscription")

  await expect(pageHeading(page)).toHaveText("Abonelik")
  // The package's place says it is not linked yet; one tile per applied limit, in two groups
  await expect(page.getByRole("heading", { name: "Paket bilgisi henüz yok" })).toBeVisible()
  const totals = page.getByRole("list", { name: "Mağaza geneli" })
  const monthly = page.getByRole("list", { name: /^Bu ay/ })
  await expect(totals.getByRole("listitem")).toHaveCount(3)
  await expect(monthly.getByRole("listitem")).toHaveCount(2)
  await expect(page.getByText("Paket limiti yok")).toBeVisible()
  // Read only: the tiles have nothing to press but the orders tile's (i)
  await expect(totals.getByRole("button")).toHaveCount(0)
  await expect(monthly.getByRole("button")).toHaveCount(1)
  await page.waitForLoadState("networkidle")
  await guard.assertHealthy()
})
