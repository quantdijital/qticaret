import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"
import { SCREENS, SIGNED_OUT_SCREENS } from "./support/screens"

/**
 * Every screen, light and dark (the panel follows the system), WCAG 2.1 A
 * and AA (docs/18 §8): no serious or critical issue. The phone project
 * runs the same at a phone's size.
 */
const MODES = ["light", "dark"] as const

async function seriousIssues(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`
    )
}

async function check(page: Page, path: string) {
  for (const mode of MODES) {
    await test.step(mode, async () => {
      await page.emulateMedia({ colorScheme: mode })
      await page.goto(path)
      await expect(pageHeading(page)).toBeVisible()
      await page.waitForLoadState("networkidle")
      expect(await seriousIssues(page)).toEqual([])
    })
  }
}

for (const path of SCREENS) {
  test(`${path} has no serious accessibility issue, light or dark`, async ({ page }) => {
    await check(page, path)
  })
}

test("a shop's page and its dialogs have no serious accessibility issue", async ({ page }) => {
  await page.goto("/tenants")
  await expect(pageHeading(page)).toHaveText("Mağazalar")
  await page.waitForLoadState("networkidle")
  const first = page.getByRole("table").getByRole("link").first()
  // A machine without any shop yet has no page to check (`cp:seed-dev` makes some)
  test.skip((await first.count()) === 0, "no shop on this machine")
  await first.click()
  await expect(page.getByRole("tab", { name: /^Yetkililer/ })).toBeVisible()
  // Each mode from a fresh load, as every other screen: no colour caught mid-transition
  await check(page, new URL(page.url()).pathname)
  // Ek C9: the package tab, with its flags and plan document cards
  await check(page, `${new URL(page.url()).pathname}?part=plan`)
  for (const [tab, opener, dialogName] of [
    [/^Yetkililer/, /^(Yetkili ekle)$/, "Yetkili ekle"],
    [/^Paket ve limitler/, /^(Paketi değiştir|Paket ata)$/, "Paket"],
  ] as const) {
    await page.getByRole("tab", { name: tab }).click()
    await page.getByRole("button", { name: opener }).first().click()
    await expect(page.getByRole("dialog", { name: dialogName })).toBeVisible()
    expect(await seriousIssues(page)).toEqual([])
    await page.getByRole("button", { name: "Vazgeç" }).click()
  }
})

test("the package dialog has no serious accessibility issue", async ({ page }) => {
  await page.goto("/packages")
  await expect(pageHeading(page)).toHaveText("Paketler")
  await page.getByRole("button", { name: "Yeni paket" }).click()
  await expect(page.getByRole("dialog", { name: "Yeni paket" })).toBeVisible()
  expect(await seriousIssues(page)).toEqual([])
  await page.getByRole("button", { name: "Vazgeç" }).click()
})

test("the step-up dialog has no serious accessibility issue", async ({ page }) => {
  await page.goto("/account")
  await expect(pageHeading(page)).toBeVisible()
  // Its trigger: a sensitive change; the dialog is closed again without a code
  await page.getByRole("button", { name: "Yeni kurtarma kodları" }).click()
  await expect(page.getByRole("dialog", { name: "Kimliğinizi doğrulayın" })).toBeVisible()
  expect(await seriousIssues(page)).toEqual([])
  await page.getByRole("button", { name: "Vazgeç" }).click()
})

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const path of SIGNED_OUT_SCREENS) {
    test(`${path} has no serious accessibility issue, light or dark`, async ({ page }) => {
      await check(page, path)
    })
  }
})
