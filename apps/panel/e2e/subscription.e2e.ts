import { expect, pageHeading, test } from "./support/guard"

/**
 * adr/0061 Ek C14: Settings > Abonelik, read only. The e2e backend runs
 * without a control plane (development): the page shows only the usage
 * tiles, every one unlimited, read only. The managed page
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
  // One tile per applied limit, each unlimited without a control plane
  const usage = page.getByRole("list", { name: "Limitler ve kullanım" })
  await expect(usage.getByRole("listitem")).toHaveCount(5)
  await expect(page.getByText("Paket limiti yok")).toBeVisible()
  // Read only: the tiles have nothing to press but the orders tile's (i)
  await expect(usage.getByRole("button")).toHaveCount(1)
  await page.waitForLoadState("networkidle")
  await guard.assertHealthy()
})
