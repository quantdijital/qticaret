import { seriousIssues } from "./support/axe"
import { expect, pageHeading, test } from "./support/guard"

/**
 * A shop's usage and health (adr/0061 §5.4, Ek C13) against the real
 * control plane, reading only: the shops list's health column, and the
 * shop's "Kullanım ve sağlık" tab with its two cards side by side, one
 * height, every limit's line, both probed targets in words; axe light and
 * dark. The shops come from `cp:seed-dev` (or a real run); none: skipped.
 */
test("shows a shop's usage against its limits beside its health", async ({ page, guard }) => {
  await page.goto("/tenants")
  await expect(pageHeading(page)).toHaveText("Mağazalar")
  await page.waitForLoadState("networkidle")
  await expect(page.getByRole("columnheader", { name: "Sağlık" })).toBeVisible()
  const first = page.getByRole("table").getByRole("link").first()
  test.skip((await first.count()) === 0, "no shop on this machine")
  await first.click()
  await page.getByRole("tab", { name: "Kullanım ve sağlık" }).click()
  await expect(page).toHaveURL(/part=usage/)

  const usage = page.locator("section", {
    has: page.getByRole("heading", { name: "Kullanım", exact: true }),
  })
  const health = page.locator("section", {
    has: page.getByRole("heading", { name: "Sağlık", exact: true }),
  })
  await expect(usage).toBeVisible()
  await expect(health).toBeVisible()
  const lines = usage.getByRole("list", { name: "Kullanım ve limitler" }).getByRole("listitem")
  await expect(lines).toHaveCount(6)
  await expect(usage.getByText("Aylık sipariş")).toBeVisible()
  await expect(health.getByRole("region", { name: "Arka uç" })).toBeVisible()
  await expect(health.getByRole("region", { name: "Vitrin" })).toBeVisible()
  // Side by side, one height: no empty space under the shorter card (docs/18 §2)
  const [left, right] = await Promise.all([usage.boundingBox(), health.boundingBox()])
  expect(left?.y).toBe(right?.y)
  expect(Math.abs((left?.height ?? 0) - (right?.height ?? -10))).toBeLessThanOrEqual(1)
  // Never "blocked" for the orders: the words say a warning at most
  await expect(usage.getByText(/engellendi/i)).toHaveCount(0)
  await guard.assertHealthy()
})

test("the usage and health tab has no serious accessibility issue, light or dark", async ({
  page,
}) => {
  await page.goto("/tenants")
  await page.waitForLoadState("networkidle")
  const first = page.getByRole("table").getByRole("link").first()
  test.skip((await first.count()) === 0, "no shop on this machine")
  await first.click()
  await expect(page.getByRole("tab", { name: /^Yetkililer/ })).toBeVisible()
  const path = `${new URL(page.url()).pathname}?part=usage`
  for (const mode of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: mode })
    await page.goto(path)
    await expect(page.getByRole("heading", { name: "Sağlık", exact: true })).toBeVisible()
    await page.waitForLoadState("networkidle")
    expect(await seriousIssues(page)).toEqual([])
  }
})
