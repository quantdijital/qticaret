import type { Page } from "@playwright/test"
import { seriousIssues } from "./support/axe"
import { expect, pageHeading, test } from "./support/guard"
import { SCREENS, SIGNED_OUT_SCREENS } from "./support/screens"

/**
 * Every screen, light and dark (the panel follows the system), WCAG 2.1 A
 * and AA (docs/18 §8): no serious or critical issue. The phone project
 * runs the same at a phone's size.
 */
const MODES = ["light", "dark"] as const

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
  // Ek C13: the usage and health tab
  await check(page, `${new URL(page.url()).pathname}?part=usage`)
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

/** The wizard through its steps, axe at each (its inline errors shown first where it has some). */
async function walkWizard(page: Page) {
  const next = () => page.getByRole("button", { name: "İleri" }).click()
  const issues = async (where: string) => {
    expect(await seriousIssues(page), where).toEqual([])
  }
  await next()
  await issues("company")
  await page.getByLabel("Mağaza adı").fill("Kalem Atölyesi")
  await next()
  await next()
  await issues("contacts")
  await page.getByLabel("Ad soyad").fill("Ayşe Demir")
  await page.getByLabel("E-posta").fill("ayse.demir@kalematolyesi.com")
  await next()
  await page.waitForLoadState("networkidle")
  await issues("package")
  const packages = page.getByRole("radio")
  test.skip((await packages.count()) === 0, "no package on sale on this machine")
  await packages.first().click()
  await next()
  await page.getByLabel("Alan adı").fill("kalematolyesi")
  await expect(page.getByText("Alan adı geçerli değil.").first()).toBeVisible()
  await issues("address")
  await page.getByLabel("Alan adı").fill("")
  await page.getByLabel("Platform adresi").fill(`kalem-${String(Date.now()).slice(-6)}`)
  await expect(page.getByText("Bu adres kullanılabilir.")).toBeVisible()
  await next()
  await issues("sector")
  await next()
  await issues("review")
}

for (const mode of MODES) {
  // One mode a run, set before the page loads: the wizard keeps its state in memory only
  test(`the new shop wizard has no serious accessibility issue, ${mode} (C11)`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: mode })
    await page.goto("/tenants/new")
    await expect(pageHeading(page)).toHaveText("Yeni mağaza")
    await walkWizard(page)
  })
}

test("a shop's setup tab has no serious accessibility issue, light or dark (C11)", async ({
  page,
}) => {
  await page.goto("/tenants")
  await page.waitForLoadState("networkidle")
  const first = page.getByRole("table").getByRole("link").first()
  test.skip((await first.count()) === 0, "no shop on this machine")
  await first.click()
  await expect(page.getByRole("tab", { name: /^Yetkililer/ })).toBeVisible()
  // The tab as it is for this shop (its runs if any; a recorded run: wizard.e2e.ts)
  await check(page, `${new URL(page.url()).pathname}?part=setup`)
  await expect(page.getByRole("heading", { name: "İşlemler" })).toBeVisible()
})

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const path of SIGNED_OUT_SCREENS) {
    test(`${path} has no serious accessibility issue, light or dark`, async ({ page }) => {
      await check(page, path)
    })
  }
})
