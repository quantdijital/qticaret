import { expect, pageHeading, test } from "./support/guard"

/**
 * adr/0061 Ek C14: Settings > Abonelik, read only. The e2e backend runs
 * without a control plane (development): the page says the shop has no
 * package limits and lists its use, with nothing to press. The managed
 * page (bars, package, payment) is covered by the panel's unit tests.
 */
test("opens Settings > Abonelik from the settings menu, read only", async ({ page, guard }) => {
  await page.goto("/settings")
  await page
    .getByRole("link", { name: /^Abonelik/ })
    .first()
    .click()
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
