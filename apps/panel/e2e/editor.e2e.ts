import { expect, pageHeading, test } from "./support/guard"

/**
 * The theme editor (adr/0049) opens from the menu, full screen, with the
 * storefront's draft in its frame. Read only: nothing is changed, so
 * nothing is saved (a shop that never saved its design saves the default
 * one on first open, which changes nothing it shows).
 */
test("opens the theme editor with the draft in the preview and a section's settings", async ({
  page,
  guard,
}) => {
  await page.goto("/storefront/menus")
  await page
    .getByRole("navigation", { name: "Ana menü" })
    .getByRole("link", { name: "Tema düzenleyici" })
    .click()
  await expect(page).toHaveURL(/\/storefront\/editor$/)
  await expect(pageHeading(page)).toHaveText("Tema düzenleyici")
  // Full screen: the panel's own menu is not there
  await expect(page.getByRole("navigation", { name: "Ana menü" })).toHaveCount(0)

  const tree = page.getByRole("navigation", { name: "Sayfanın bölümleri" })
  await expect(tree.getByRole("heading", { name: "Ana sayfa" })).toBeVisible()
  const frame = page.locator("iframe[data-storefront-preview]")
  // The frame shows the draft: the editor's live session (`sfs_`, adr/0065 §1), or the
  // signed design link (`sfl_`) it falls back to when no storefront answers within
  // READY_MS (5 s). No storefront runs beside the CI backend, so which one is seen
  // depends on how soon this line runs
  await expect(frame).toHaveAttribute("src", /\/onizleme\/sf[sl]_/)
  // The storefront allows the panel to frame its preview page: the draft's page shows inside
  await expect(page.frameLocator("iframe[data-storefront-preview]").locator("body")).toBeVisible({
    timeout: 30_000,
  })

  await tree.getByRole("button", { name: "Tema ayarları" }).click()
  await expect(page.getByRole("heading", { name: "Tema ayarları" })).toBeVisible()
  await page.getByRole("button", { name: "Bölümlere dön" }).click()
  await expect(tree).toBeVisible()

  await page.getByRole("button", { name: "Sürümler" }).click()
  await expect(page.getByRole("dialog", { name: "Yayınlanan sürümler" })).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "Çık", exact: true }).click()
  await expect(page).toHaveURL(/\/storefront\/menus$/)
  await guard.assertHealthy()
})

/**
 * The owner, 2026-11-03: the editor was cramped. Read only, at a desktop,
 * a laptop and a phone size: the bar's controls all on show, no field
 * narrower than 160 px, the preview scaled into its room rather than cut
 * off, the page's parts beside the settings, in a drawer, or one view at a
 * time.
 */
test("lays the theme editor out for the window it has", async ({ page, guard }) => {
  const bar = page.getByRole("banner")
  const preview = page.locator("iframe[data-storefront-preview]")
  const fits = () =>
    preview.evaluate((frame) => {
      const box = frame.parentElement?.getBoundingClientRect()
      const room = frame.closest('[data-editor-column="preview"]')?.getBoundingClientRect()
      return Boolean(
        box &&
        room &&
        box.width > 0 &&
        box.left >= room.left - 1 &&
        box.right <= room.right + 1 &&
        box.bottom <= room.bottom + 1
      )
    })
  const narrowFields = () =>
    page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          '[data-editor-column="settings"] :is(input:not([type=color]):not([type=checkbox]):not([type=radio]), textarea, [role=combobox]), header [role=combobox]'
        )
      )
        .map((field) => field.getBoundingClientRect().width)
        .filter((width) => width > 0 && width < 159.5)
    )
  const barReady = async () => {
    await expect(bar.getByRole("button", { name: "Çık", exact: true })).toBeVisible()
    await expect(bar.getByRole("combobox", { name: "Düzenlenen sayfa" })).toBeVisible()
    await expect(bar.getByRole("button", { name: "Yayınla" })).toBeVisible()
    await expect(bar.getByRole("status", { name: "Taslağın durumu" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()?.width ?? 0
    )
  }
  const tree = page.getByRole("navigation", { name: "Sayfanın bölümleri" })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/storefront/editor")
  await expect(pageHeading(page)).toHaveText("Tema düzenleyici")
  await barReady()
  await tree.getByRole("button", { name: "Tema ayarları" }).click()
  await expect(page.getByRole("region", { name: "Tema ayarları" })).toBeVisible()
  await expect(tree).toBeVisible()
  await expect(preview).toBeVisible({ timeout: 30_000 })
  await expect.poll(fits).toBe(true)
  expect(await narrowFields()).toEqual([])
  await page.getByRole("radio", { name: "Tablet", exact: true }).click()
  await expect(preview).toHaveAttribute("data-device", "tablet")
  await expect.poll(fits).toBe(true)

  // A laptop: the parts fold into a drawer beside the settings
  await page.setViewportSize({ width: 1100, height: 800 })
  await barReady()
  await expect(tree).toHaveCount(0)
  await page.getByRole("button", { name: "Bölümler", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Sayfanın bölümleri" })).toBeVisible()
  await page.keyboard.press("Escape")
  expect(await narrowFields()).toEqual([])
  await expect.poll(fits).toBe(true)

  // A phone: the settings or the preview, switched from the bar
  await page.setViewportSize({ width: 390, height: 844 })
  await barReady()
  await expect(page.getByRole("region", { name: "Tema ayarları" })).toBeVisible()
  await expect(preview).toBeHidden()
  expect(await narrowFields()).toEqual([])
  await page.getByRole("radio", { name: "Önizle", exact: true }).click()
  await expect(preview).toBeVisible()
  await expect.poll(fits).toBe(true)
  await page.getByRole("radio", { name: "Düzenle", exact: true }).click()
  await expect(page.getByRole("region", { name: "Tema ayarları" })).toBeVisible()
  await guard.assertHealthy()
})
