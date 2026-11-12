import { expect, pageHeading, test } from "./support/guard"
import { SCREENS, SIGNED_OUT_SCREENS } from "./support/screens"

/** Every screen opens with no error, script or server, and no raw key. */
test("opens every screen of the panel without an error", async ({ page, guard }) => {
  for (const path of SCREENS) {
    await test.step(path, async () => {
      await page.goto(path)
      await expect(pageHeading(page)).toBeVisible()
      await page.waitForLoadState("networkidle")
      await guard.assertHealthy()
    })
  }
})

test("leads through the menu, every section open", async ({ page }, info) => {
  await page.goto("/")
  await expect(pageHeading(page)).toHaveText("Gösterge")
  if (info.project.name === "phone") {
    // On a phone the menu is a drawer behind the top bar's button
    await page.getByRole("button", { name: "Menü", exact: true }).click()
  }
  const menu = page.getByRole("navigation", { name: "Ana menü" })
  for (const section of ["Mağazalar", "Paketler", "Ödemeler", "Sürümler"]) {
    await expect(menu.getByRole("link", { name: section })).toBeVisible()
  }
  await expect(menu.getByText("Yakında")).toHaveCount(0)
  await menu.getByRole("link", { name: "Mağazalar" }).click()
  await expect(pageHeading(page)).toHaveText("Mağazalar")
  if (info.project.name === "phone") {
    await page.getByRole("button", { name: "Menü", exact: true }).click()
  }
  await menu.getByRole("link", { name: "Personel" }).click()
  await expect(pageHeading(page)).toHaveText("Personel")
  await expect(page.getByRole("table").first()).toContainText("(siz)")
})

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("opens the pages before sign-in", async ({ page, guard }) => {
    for (const path of SIGNED_OUT_SCREENS) {
      await test.step(path, async () => {
        await page.goto(path)
        await expect(pageHeading(page)).toBeVisible()
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
