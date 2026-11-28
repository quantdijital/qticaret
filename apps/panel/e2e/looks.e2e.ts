import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * Vitrin › Görünümler (adr/0064 Ek 2026-11-17): a ready-made look goes into
 * the draft and the editor opens on it with a note; the draft changed there
 * is kept automatically when another look replaces it, and comes back from
 * the saved looks.
 *
 * Needs the backend's saved looks endpoints (`/admin/storefront-designs`,
 * the apply's `auto_saved`): this file and the gallery's screen in
 * `support/screens.ts` fail until that backend is in `dev`, so the panel's
 * PR is merged after the backend's.
 *
 * The look is `cutlery/katalog`: `general` has no ready-made look since
 * Grafit was removed (owner, 2026-11-17), so CI gives its demo shop
 * (seed:demo) the cutlery pack (`tenant:apply-pack pack=cutlery`,
 * .github/workflows/ci.yml) and the gallery lists that pack's looks. Katalog
 * has no menus and no images; nothing here leans on another look. The draft
 * is changed and put back; the saved looks this run wrote are deleted at the
 * end. Nothing is published.
 */

const LOOK = "Katalog"

const DESIGNS = "/admin/storefront-designs"

async function designIds(page: Page): Promise<string[]> {
  const answer = await page.request.get(DESIGNS)
  expect(answer.ok()).toBe(true)
  const body = (await answer.json()) as { designs: { id: string }[] }
  return body.designs.map((each) => each.id)
}

/** The apply dialog for a look, confirmed; the editor opens on the new draft. */
async function confirmApply(page: Page, look: string) {
  const dialog = page.getByRole("dialog", { name: `‘${look}’ taslağa uygulansın mı?` })
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Taslağa uygula ve düzenle" }).click()
  await expect(page).toHaveURL(/\/storefront\/editor$/)
  await expect(page.getByRole("status").filter({ hasText: "taslağa uygulandı." })).toBeVisible()
}

/** Back to the gallery from the editor's bar: what waits there is stored first. */
async function toGallery(page: Page) {
  await page.getByRole("button", { name: "Görünümler" }).click()
  await page.getByRole("menuitem", { name: "Tüm görünümler" }).click()
  await expect(page).toHaveURL(/\/storefront\/looks$/)
  await expect(pageHeading(page)).toHaveText("Görünümler")
}

test("applies a look, keeps the changed draft automatically and brings it back", async ({
  page,
  guard,
}) => {
  test.setTimeout(120_000)
  await page.goto("/storefront/looks")
  await expect(pageHeading(page)).toHaveText("Görünümler")
  const before = new Set(await designIds(page))

  try {
    await page.getByRole("button", { name: `‘${LOOK}’ görünümünü taslağa uygula` }).click()
    await confirmApply(page, LOOK)

    // A change in the draft: the home page's first section hidden. Not the
    // header's: a look that leaves the header empty keeps the shop's own, so
    // a hidden announcement would stay hidden after it.
    const tree = page
      .getByRole("navigation", { name: "Sayfanın bölümleri" })
      .getByRole("group", { name: "Ana sayfa", exact: true })
    const hide = tree.getByRole("button", { name: / bölümünü gizle$/ }).first()
    const hidden = ((await hide.getAttribute("aria-label")) ?? "").replace(/ bölümünü gizle$/, "")
    // The section by its name (two of a kind share one: the first is the one hidden)
    const row = (verb: string) =>
      tree.getByRole("button", { name: `${hidden} bölümünü ${verb}`, exact: true }).first()
    expect(hidden).not.toBe("")
    await hide.click()
    await expect(row("göster")).toBeVisible()

    // The look again: the changed draft is kept before it goes
    await toGallery(page)
    await page.getByRole("button", { name: `‘${LOOK}’ görünümünü taslağa uygula` }).click()
    await confirmApply(page, LOOK)
    await expect(row("gizle")).toBeVisible()

    await toGallery(page)
    const saved = page.getByRole("region", { name: /^Kayıtlı görünümlerim/ })
    // The automatic saves are folded into one list, closed until opened (the choice remembered)
    const autoFold = saved.getByRole("button", { name: /^Otomatik kayıtlar \(\d+\)$/ })
    if ((await autoFold.getAttribute("aria-expanded")) !== "true") {
      await autoFold.click()
    }
    const kept = saved.getByRole("button", {
      name: new RegExp(`^‘${LOOK}, .+, düzenlenmiş’ görünümünü taslağa al$`),
    })
    await expect(kept.first()).toBeVisible()
    const keptName = ((await kept.first().getAttribute("aria-label")) ?? "").replace(
      /^‘(.+)’ görünümünü taslağa al$/,
      "$1"
    )
    await kept.first().click()
    await confirmApply(page, keptName)
    await expect(row("göster")).toBeVisible()

    // Put the section back as the look has it, stored before leaving
    await row("göster").click()
    await toGallery(page)
    await guard.assertHealthy()
  } finally {
    for (const id of await designIds(page)) {
      if (!before.has(id)) {
        const answer = await page.request.delete(`${DESIGNS}/${encodeURIComponent(id)}`)
        expect(answer.ok()).toBe(true)
      }
    }
  }
})
