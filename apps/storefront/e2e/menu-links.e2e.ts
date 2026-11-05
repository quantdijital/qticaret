import { expect, test } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"
import { dismissCookies } from "./support"

/**
 * The category menu's links are followed by a real press (owner
 * 2026-11-05: "mega menüdeki linklere tıklayıp gidemiyorum"): a panel
 * that closed on the press itself took its link away before the click
 * landed. Opened by a press and by hover on a desktop, and in the
 * phone's drawer, a link in it leads to its page.
 */

const categoriesNav = (page: Page) => page.getByRole("navigation", { name: "Kategoriler" }).first()

/** The first category button that opens a panel, and a link to a category under it. */
async function openPanel(page: Page, how: "press" | "hover"): Promise<Locator> {
  const trigger = categoriesNav(page).locator("button[aria-expanded]").first()
  await expect(trigger).toBeVisible()
  if (how === "press") {
    await trigger.click()
  } else {
    await trigger.hover()
  }
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  const panel = page.locator(`[id="${(await trigger.getAttribute("aria-controls")) ?? ""}"]`)
  const link = panel.locator('a[href^="/kategori/"]').last()
  await expect(link).toBeVisible()
  return link
}

async function follows(page: Page, link: Locator) {
  const href = (await link.getAttribute("href")) ?? ""
  expect(href).not.toBe("")
  await Promise.all([page.waitForURL((url) => url.pathname === href), link.click()])
}

test.describe("the category menu on a desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("a link in a panel opened by a press leads to its page", async ({ page }) => {
    await page.goto("/")
    await dismissCookies(page)
    await follows(page, await openPanel(page, "press"))
  })

  test("a link in a panel opened by hover leads to its page", async ({ page }) => {
    await page.goto("/")
    await dismissCookies(page)
    await follows(page, await openPanel(page, "hover"))
  })
})

test.describe("the menu drawer on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("a category under a group leads to its page", async ({ page }) => {
    await page.goto("/")
    await dismissCookies(page)
    await page.getByRole("button", { name: "Menüyü aç" }).click()
    const drawer = page.getByRole("dialog")
    await expect(drawer).toBeVisible()
    await drawer.locator("summary").first().click()
    const link = drawer.locator('details[open] a[href^="/kategori/"]').last()
    await follows(page, link)
  })
})
