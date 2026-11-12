import type { Locator, Page } from "@playwright/test"
import { seriousIssues } from "./support/axe"
import { expect, pageHeading, test } from "./support/guard"
import { e2eSlug, makeReportingShop, removeE2eShop } from "./support/shops"
import { proveStepUp } from "./support/step-up"

// Making and removing the shop record boot Medusa's CLI, each tens of seconds
const CLI_TIMEOUT_MS = 180_000

const TILES = [
  "Etkin mağaza",
  "Aylık tekrarlayan gelir",
  "Geciken ödeme",
  "Yaklaşan yenileme",
  "Sağlıksız mağaza",
]

/** The heights of these elements, rounded to the pixel. */
const heightsOf = async (items: Locator) =>
  (
    await items.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))
  ).map(Math.round)

const card = (page: Page, title: string) =>
  page.locator("section", { has: page.getByRole("heading", { name: title, exact: true }) })

/**
 * adr/0061 C18, Ek C18 against the real control plane: the dashboard's
 * five tiles one height and its three lists side by side; then a release
 * added through its dialog (step-up), a shop that reports another release
 * given it as its target (step-up), its "Sürüm" tab and the shops list
 * saying it is not on target; axe on the new tab and dialog, light and
 * dark. The shop is a record of the e2e's shape that reports a release
 * (no setup), removed after; the teardown removes the e2e's releases.
 */
test("shows the dashboard's tiles one height and its three lists side by side", async ({
  page,
  guard,
}) => {
  await page.goto("/")
  await expect(pageHeading(page)).toHaveText("Gösterge")
  const strip = page.getByRole("region", { name: "Platform özeti" })
  for (const label of TILES) {
    await expect(strip.getByText(label, { exact: true })).toBeVisible()
  }
  const tiles = await heightsOf(strip.locator(":scope > div"))
  expect(tiles).toHaveLength(5)
  expect(Math.max(...tiles) - Math.min(...tiles)).toBeLessThanOrEqual(1)
  const lists = [
    card(page, "Geciken ödemeler"),
    card(page, "Yaklaşan yenilemeler"),
    card(page, "Dikkat isteyen mağazalar"),
  ]
  const boxes = await Promise.all(lists.map((each) => each.boundingBox()))
  expect(new Set(boxes.map((box) => Math.round(box?.y ?? -1))).size).toBe(1)
  const heights = boxes.map((box) => Math.round(box?.height ?? 0))
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
  await guard.assertHealthy()
})

test("adds a release, makes it a shop's target and shows the drift", async ({ page, guard }) => {
  test.setTimeout(2 * CLI_TIMEOUT_MS + 120_000)
  const slug = e2eSlug()
  const version = `0.0.0-e2e.${String(Date.now())}`
  makeReportingShop(slug, "1.4.0", "8a128bbe0c3d")
  try {
    await page.goto("/releases")
    await expect(pageHeading(page)).toHaveText("Sürümler")
    await expect(page.getByText(/yalnızca niyeti kaydeder/)).toBeVisible()
    await page.getByRole("button", { name: "Sürüm ekle" }).click()
    const add = page.getByRole("dialog", { name: "Sürüm ekle" })
    // Checked as opened: typing lights "Sürüm ekle", and axe must not catch its colour mid-transition
    await expect(add).toBeVisible()
    expect(await seriousIssues(page)).toEqual([])
    await add.getByLabel("Sürüm numarası").fill(version)
    await add.getByLabel("Commit").fill("ABCDEF1234567")
    await add.getByLabel("Not").fill("Ödeme adımı hızlandı")
    await add.getByRole("button", { name: "Sürüm ekle" }).click()
    await proveStepUp(page)
    await expect(add).toBeHidden()
    const row = page.getByRole("row", { name: new RegExp(version.replace(/\./g, "\\.")) })
    await expect(row).toContainText("abcdef123456")
    await expect(row).toContainText("Ödeme adımı hızlandı")

    await page.goto(`/tenants?q=${slug}`)
    await page.getByRole("table").getByRole("link", { name: "Kalem Atölyesi" }).click()
    await page.getByRole("tab", { name: "Sürüm", exact: true }).click()
    await expect(page).toHaveURL(/part=version/)
    const tab = card(page, "Sürüm")
    await expect(tab.getByText("1.4.0 · 8a128bbe0c3d")).toBeVisible()
    await expect(tab.getByText("Karşılaştırılamıyor")).toBeVisible()
    await tab.getByRole("button", { name: "Hedef sürümü değiştir" }).click()
    const target = page.getByRole("dialog", { name: "Hedef sürümü değiştir" })
    const choice = target.getByLabel(new RegExp(`^${version.replace(/\./g, "\\.")}`))
    await expect(choice).toBeVisible()
    expect(await seriousIssues(page)).toEqual([])
    await choice.click()
    await target.getByLabel("Gerekçe").fill("Pilot grubu")
    await target.getByRole("button", { name: "Kaydet" }).click()
    await proveStepUp(page)
    await expect(target).toBeHidden()
    await expect(tab.getByText("Hedefte değil")).toBeVisible()
    await expect(tab.getByText(`${version} · abcdef123456`)).toBeVisible()
    await expect(tab.getByText("Pilot grubu")).toBeVisible()

    await page.goto(`/tenants?q=${slug}`)
    const listed = page.getByRole("row", { name: /Kalem Atölyesi/ })
    await expect(listed).toContainText("1.4.0")
    await expect(listed).toContainText("Hedefte değil")
    await guard.assertHealthy()

    // The new tab, light and dark, from a fresh load each
    await page.getByRole("table").getByRole("link", { name: "Kalem Atölyesi" }).click()
    const path = `${new URL(page.url()).pathname}?part=version`
    for (const mode of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: mode })
      await page.goto(path)
      await expect(card(page, "Sürüm").getByText("Hedefte değil")).toBeVisible()
      await page.waitForLoadState("networkidle")
      expect(await seriousIssues(page)).toEqual([])
    }
  } finally {
    removeE2eShop(slug)
  }
})
