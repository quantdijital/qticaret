import { expect, pageHeading, test } from "./support/guard"

/**
 * adr/0061 Ek C14: Settings > Abonelik, read only. The e2e backend runs
 * without a control plane (development): the page says the shop has no
 * package limits and lists its use, with nothing to press. The managed
 * page (bars, package, payment) is covered by the panel's unit tests.
 */
test("opens Settings > Abonelik from the settings menu, read only", async ({ page, guard }) => {
  await page.goto("/settings")
  // The settings home's own card (its line on what the section holds); the side menu's
  // link of the same name sat under the app's sidebar after Playwright scrolled it into
  // view on a CI runner, and the sidebar took the click
  await page.getByRole("link", { name: /^Abonelik\s+Paketiniz/ }).click()
  await page.waitForURL("**/settings/subscription")

  await expect(pageHeading(page)).toHaveText("Abonelik")
  const usage = page.getByRole("list", { name: "Limitler ve kullanım" })
  await expect(usage.getByRole("listitem")).toHaveCount(5)
  await expect(page.getByText("Bu mağazada paket limiti yok", { exact: false })).toBeVisible()
  // Read only: the page's card has nothing to press (the shell's menus are elsewhere)
  const card = page.locator("section").filter({ has: usage }).last()
  await expect(card.getByRole("button")).toHaveCount(0)
  await page.waitForLoadState("networkidle")
  await guard.assertHealthy()
})
