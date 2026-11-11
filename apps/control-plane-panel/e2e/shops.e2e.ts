import { expect, pageHeading, test } from "./support/guard"

/**
 * The shops and packages screens (adr/0061 §2, C7) against the real
 * control plane, reading only: nothing here writes (a dialog is opened
 * and closed). The shops come from `pnpm --filter control-plane
 * cp:seed-dev`; on a machine without any, the shop's page is skipped.
 */
test("finds a shop, opens its page and walks its tabs", async ({ page, guard }) => {
  await page.goto("/tenants")
  await expect(pageHeading(page)).toHaveText("Mağazalar")
  await page.waitForLoadState("networkidle")
  const rows = page.getByRole("table").getByRole("link")
  test.skip((await rows.count()) === 0, "no shop on this machine")
  const name = (await rows.first().innerText()).trim()
  await page
    .getByRole("searchbox")
    .or(page.getByPlaceholder("Ad ya da adresle ara"))
    .first()
    .fill(name.slice(0, 4))
  await expect(page).toHaveURL(/q=/)
  await page.getByRole("table").getByRole("link", { name }).click()
  await expect(pageHeading(page)).toHaveText(name)
  await expect(page.getByRole("heading", { name: "Firma" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Özet" })).toBeVisible()
  for (const tab of [/^Alan adları/, /^Paket ve limitler/, /^Etkinlik/, /^Yetkililer/]) {
    await page.getByRole("tab", { name: tab }).click()
    await expect(page).toHaveURL(/part=/)
  }
  // Ek C9: the package tab's platform flags and, for the owner, the plan document
  await page.getByRole("tab", { name: /^Paket ve limitler/ }).click()
  await expect(page.getByRole("heading", { name: "Platform özellikleri" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Plan belgesi" })).toBeVisible()
  await guard.assertHealthy()
})

test("opens the new shop wizard from the list and leaves it untouched (C11)", async ({
  page,
  guard,
}) => {
  await page.goto("/tenants")
  await page.getByRole("link", { name: "Yeni mağaza" }).click()
  await expect(pageHeading(page)).toHaveText("Yeni mağaza")
  await expect(page.getByRole("heading", { name: "Firma", level: 2 })).toBeVisible()
  // Nothing typed: leaving asks nothing
  await page.getByRole("link", { name: "Vazgeç" }).click()
  await expect(pageHeading(page)).toHaveText("Mağazalar")
  await guard.assertHealthy()
})

test("lists the packages and opens one", async ({ page, guard }) => {
  await page.goto("/packages")
  await expect(pageHeading(page)).toHaveText("Paketler")
  await page.waitForLoadState("networkidle")
  const rows = page.getByRole("table").getByRole("button")
  test.skip((await rows.count()) === 0, "no package on this machine")
  const name = (await rows.first().innerText()).trim()
  await rows.first().click()
  await expect(page.getByRole("dialog", { name })).toBeVisible()
  await expect(
    page.getByRole("dialog", { name }).getByRole("heading", { name: "Platform özellikleri" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Vazgeç" }).click()
  await page.getByRole("tab", { name: /^Arşivde/ }).click()
  await guard.assertHealthy()
})
