import { expect, pageHeading, platformBar, test } from "./support/guard"
import { SCREENS, SIGNED_OUT_SCREENS } from "./support/screens"

/** Every screen opens, the "Üst panel" bar on it, with no error, script or server, and no raw key. */
test("opens every screen of the panel without an error", async ({ page, guard }) => {
  for (const path of SCREENS) {
    await test.step(path, async () => {
      await page.goto(path)
      await expect(pageHeading(page)).toBeVisible()
      await expect(platformBar(page)).toBeVisible()
      await page.waitForLoadState("networkidle")
      await guard.assertHealthy()
    })
  }
})

test("leads through the menu, the sections still to come shown but closed", async ({
  page,
}, info) => {
  await page.goto("/")
  await expect(pageHeading(page)).toHaveText("Gösterge")
  if (info.project.name === "phone") {
    // On a phone the menu is a drawer behind the top bar's button
    await page.getByRole("button", { name: "Menü", exact: true }).click()
  }
  const menu = page.getByRole("navigation", { name: "Ana menü" })
  for (const soon of ["Mağazalar", "Paketler", "Ödemeler", "Sürümler"]) {
    await expect(menu.getByRole("button", { name: new RegExp(`^${soon}`) })).toBeDisabled()
  }
  await menu.getByRole("link", { name: "Personel" }).click()
  await expect(pageHeading(page)).toHaveText("Personel")
  await expect(page.getByRole("table").first()).toContainText("(siz)")
})

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("opens the pages before sign-in, the bar on each", async ({ page, guard }) => {
    for (const path of SIGNED_OUT_SCREENS) {
      await test.step(path, async () => {
        await page.goto(path)
        await expect(pageHeading(page)).toBeVisible()
        await expect(platformBar(page)).toBeVisible()
        await page.waitForLoadState("networkidle")
        await guard.assertHealthy()
      })
    }
  })

  test("sends a signed-out visit to sign-in", async ({ page }) => {
    await page.goto("/staff")
    await expect(page).toHaveURL(/\/login\?redirect=%2Fstaff$/)
    await expect(pageHeading(page)).toHaveText("Üst panele giriş")
  })
})
