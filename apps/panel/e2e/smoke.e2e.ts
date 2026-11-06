import { expect, pageHeading, test } from "./support/guard"
import { SECTIONS, SETTINGS } from "./support/screens"

// A page takes a few seconds on a CI runner: a test that walks many gets that much per page
const PER_PAGE_MS = 10_000

/** Docs/06's smoke test: every screen a shop uses opens, with no error, script or server. */
test("opens every main section without an error", async ({ page, guard }) => {
  test.setTimeout(SECTIONS.length * PER_PAGE_MS)
  for (const path of SECTIONS) {
    await test.step(path, async () => {
      await page.goto(path)
      await expect(pageHeading(page)).toBeVisible()
      await page.waitForLoadState("networkidle")
      await guard.assertHealthy()
    })
  }
})

test("opens every settings page without an error", async ({ page, guard }) => {
  test.setTimeout(SETTINGS.length * PER_PAGE_MS)
  for (const path of SETTINGS) {
    await test.step(path, async () => {
      await page.goto(path)
      await expect(pageHeading(page)).toBeVisible()
      await page.waitForLoadState("networkidle")
      await guard.assertHealthy()
    })
  }
})

// A collapsed menu's hidden group label once lay over the item above it and took its click
test("opens each section from the collapsed menu's icons", async ({ page, guard }) => {
  await page.goto("/")
  await expect(pageHeading(page)).toBeVisible()
  const sidebar = page.locator('[data-slot="sidebar"]')
  // Whatever the shop's menu behaviour, it starts collapsed here
  if ((await sidebar.getAttribute("data-state")) === "expanded") {
    await page.locator('[data-sidebar="trigger"]').first().click()
  }
  const items = page.locator('[data-sidebar="sidebar"] a[data-sidebar="menu-button"]')
  await expect(sidebar).toHaveAttribute("data-state", "collapsed")
  const links = await items.evaluateAll((each) =>
    each.map((link) => ({
      href: link.getAttribute("href") ?? "",
      name: link.textContent.trim(),
    }))
  )
  /**
   * Off the menu, folded and still: the automatic behaviour opens it while
   * the pointer rests on it and folds it back after, and its width, labels
   * and group titles slide for a moment. An icon measured mid-slide is
   * another item's by the time the click lands.
   */
  const settle = async () => {
    await page.mouse.move(800, 400)
    await expect
      .poll(() =>
        sidebar.evaluate(
          (element) =>
            element.getAttribute("data-state") === "collapsed" &&
            !element.hasAttribute("data-peek") &&
            element
              .getAnimations({ subtree: true })
              .every((animation) => !("transitionProperty" in animation))
        )
      )
      .toBe(true)
  }
  // The theme editor opens full screen, without this menu: its own test opens it
  for (const { href, name } of links.filter((each) => each.href !== "/storefront/editor")) {
    await test.step(href, async () => {
      await settle()
      const link = sidebar.getByRole("link", { name, exact: true })
      // Folded, the icon's own point is the link's: no hidden label lies over it
      const ownsItsIcon = await link.evaluate((element) => {
        const box = (element.querySelector("svg") ?? element).getBoundingClientRect()
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return hit !== null && element.contains(hit)
      })
      expect(ownsItsIcon, `${name}'s icon takes its own click`).toBe(true)
      await link.click()
      await expect(page).toHaveURL(new RegExp(href === "/" ? "/$" : href))
    })
  }
  await guard.assertHealthy()
})

test("finds a product by its name and opens it", async ({ page, guard }) => {
  await page.goto("/products")
  const first = page.getByRole("table").getByRole("link").first()
  await expect(first).toBeVisible()
  const title = (await first.textContent()) ?? ""
  await page.getByRole("searchbox", { name: "Ürün adı ya da stok kodu ile ara" }).fill(title)
  // The search is in the address once it ran; the list then holds what it found
  await expect(page).toHaveURL(/[?&]q=/)
  await expect(page.getByRole("table").getByRole("link", { name: title }).first()).toBeVisible()
  await page.getByRole("table").getByRole("link", { name: title }).first().click()
  await expect(pageHeading(page)).toHaveText(title)
  await guard.assertHealthy()
})

test("checks a product sheet without writing it", async ({ page, guard }) => {
  await page.goto("/products")
  await page.getByRole("button", { name: "İçe aktar" }).click()
  const dialog = page.getByRole("dialog", { name: "Ürünleri içe aktar" })
  await expect(dialog).toBeVisible()
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "urunler.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      `Tanıtıcı;Ürün adı;Fiyat (TRY)\ne2e-kontrol-${String(Date.now())};E2E Kontrol;99,90\n`
    ),
  })
  await dialog.getByRole("button", { name: "Kontrol et" }).click()
  await expect(dialog.getByText("1 ürün eklenecek, 0 ürün güncellenecek.")).toBeVisible({
    timeout: 30_000,
  })
  // A check writes nothing: closing leaves the catalog as it was
  await dialog.getByRole("button", { name: "Vazgeç" }).click()
  await expect(dialog).toBeHidden()
  await guard.assertHealthy()
})

test("picks products and checks a bulk change without applying it", async ({ page, guard }) => {
  await page.goto("/products")
  const rows = page.getByRole("table").getByRole("checkbox")
  await expect(rows.nth(2)).toBeVisible()
  await rows.nth(1).check()
  await rows.nth(2).check()
  const bar = page.getByRole("region", { name: "Seçili ürünler" })
  await expect(bar.getByText("2 ürün seçildi")).toBeVisible()
  await bar.getByRole("button", { name: "Toplu düzenle" }).click()
  await page.getByRole("menuitem", { name: "Fiyatı değiştir" }).click()
  const dialog = page.getByRole("dialog", { name: "Fiyatı değiştir" })
  await dialog.getByRole("radio", { name: "Yüzde" }).check()
  await dialog.getByLabel("Oran (%)").fill("0")
  await dialog.getByRole("button", { name: "2 ürüne uygula" }).click()
  // Named on the field; nothing is sent
  await expect(dialog.getByRole("alert")).toHaveText(
    "Sıfırdan büyük, en fazla 1000 olan bir oran girin."
  )
  await dialog.getByLabel("Oran (%)").fill("10")
  await expect(dialog.getByText("Örnek: ₺100,00 → ₺110,00")).toBeVisible()
  await dialog.getByRole("button", { name: "Vazgeç" }).click()
  await expect(dialog).toBeHidden()
  await bar.getByRole("button", { name: "Seçimi kaldır" }).click()
  await expect(bar).toBeHidden()
  await guard.assertHealthy()
})

test("opens an order with what each line was paid", async ({ page, guard }) => {
  await page.goto("/orders")
  const first = page.getByRole("table").getByRole("link").first()
  await expect(first).toBeVisible()
  // The lines' money (F4.7) is read beside the order
  const money = page.waitForResponse((response) =>
    /\/admin\/orders\/[^/]+\/money/.test(response.url())
  )
  await first.click()
  await expect(page).toHaveURL(/\/orders\/order_/)
  expect((await money).status()).toBe(200)
  await expect(pageHeading(page)).toBeVisible()
  await page.waitForLoadState("networkidle")
  await guard.assertHealthy()
})

test("sends the old storefront settings address to the storefront preferences", async ({
  page,
  guard,
}) => {
  await page.goto("/settings/storefront?part=maintenance")
  await expect(page).toHaveURL(/\/storefront\/preferences\?part=maintenance$/)
  await expect(pageHeading(page)).toHaveText("Vitrin tercihleri")
  await expect(page.getByRole("tab", { name: "Bakım modu" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await guard.assertHealthy()
})

test("opens the first preferences tab for a part that moved to the theme editor", async ({
  page,
  guard,
}) => {
  // Colour swatches and "Az kaldı" are in the theme editor (adr/0049 Ek 2026-11-06)
  await page.goto("/settings/storefront?part=swatches")
  await expect(page).toHaveURL(/\/storefront\/preferences$/)
  await expect(page.getByRole("tab", { name: "İletişim formu" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await guard.assertHealthy()
})
