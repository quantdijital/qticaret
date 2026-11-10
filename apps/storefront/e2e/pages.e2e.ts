import { expect, test } from "@playwright/test"
import type { Page, Response } from "@playwright/test"
import { collectErrors } from "./support"

const robotsOf = (page: Page) => page.locator('meta[name="robots"]').getAttribute("content")

/** What an indexable page says: index, unless the shop keeps the whole site out (dev, staging). */
const indexable = (response: Response | null) =>
  response?.headers()["x-robots-tag"] ? /^noindex/ : /^index/

/** No sideways scroll at a phone's width (docs/19 §9). */
async function fitsThePhone(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe("index pages (docs/20 sayfalar)", () => {
  test("/kategoriler shows the category tree, indexable, with its trail", async ({ page }) => {
    const errors = collectErrors(page)
    const response = await page.goto("/kategoriler")
    expect(response?.status()).toBe(200)
    expect(await robotsOf(page)).toMatch(indexable(response))
    await expect(page.getByRole("heading", { level: 1, name: "Kategoriler" })).toBeVisible()
    // Each top category is a card: a link around its own heading
    await expect(
      page
        .getByRole("main")
        .getByRole("link")
        .filter({ has: page.getByRole("heading", { level: 2 }) })
        .first()
    ).toBeVisible()
    await expect(
      page.getByRole("navigation", { name: "Bulunduğunuz yer" }).getByRole("link", {
        name: "Ana sayfa",
      })
    ).toBeVisible()
    await fitsThePhone(page)
    expect(errors).toEqual([])
  })

  test("/markalar lists the brands by letter, indexable", async ({ page }) => {
    const errors = collectErrors(page)
    const response = await page.goto("/markalar")
    expect(response?.status()).toBe(200)
    expect(await robotsOf(page)).toMatch(indexable(response))
    await expect(page.getByRole("heading", { level: 1, name: "Markalar" })).toBeVisible()
    // Each letter's jump link leads to its own section
    const letters = page.getByRole("navigation", { name: "Harfe git" }).getByRole("link")
    for (const href of await letters.evaluateAll((links) =>
      links.map((link) => link.getAttribute("href"))
    )) {
      await expect(page.locator(href ?? "#none")).toHaveCount(1)
    }
    await fitsThePhone(page)
    expect(errors).toEqual([])
  })

  test("/kampanyalar lists what is on sale, out of the index while nothing is", async ({
    page,
  }) => {
    const errors = collectErrors(page)
    const response = await page.goto("/kampanyalar")
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1, name: "Kampanyalı ürünler" })).toBeVisible()
    const empty = await page.getByText("Şu an indirimde ürün yok").isVisible()
    expect(await robotsOf(page)).toMatch(empty ? /^noindex/ : indexable(response))
    await fitsThePhone(page)
    expect(errors).toEqual([])
  })
})

test.describe("site search (/arama)", () => {
  test("a search with a typo answers, results or not, never indexed", async ({ page }) => {
    const errors = collectErrors(page)
    const response = await page.goto("/arama?q=b%C4%B1cak")
    expect(response?.status()).toBe(200)
    expect(await robotsOf(page)).toMatch(/^noindex/)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("bıcak")
    // The sorts keep the words
    const sorts = page.getByRole("navigation", { name: "Sıralama" }).getByRole("link")
    if ((await sorts.count()) > 0) {
      await expect(sorts.first()).toHaveAttribute("href", /q=b%C4%B1cak/)
    }
    await fitsThePhone(page)
    expect(errors).toEqual([])
  })

  test("words the search cannot read show a hint, not an error", async ({ page }) => {
    for (const q of ["%21%21%21", "%01", "%20%20"]) {
      const response = await page.goto(`/arama?q=${q}`)
      expect(response?.status()).toBe(200)
      expect(await robotsOf(page)).toMatch(/^noindex/)
    }
    await page.goto("/arama?q=%21%21%21")
    await expect(page.getByText("en az bir harf ya da rakam")).toBeVisible()
  })

  test("a page past the last is a 404", async ({ page }) => {
    const response = await page.goto("/arama?q=zzqqxxyy&sayfa=40")
    expect(response?.status()).toBe(404)
  })
})

test.describe("in stock only (stok=var, adr/0056)", () => {
  test("turns on by a plain link, kept by the sorts, out of the index, off by its chip", async ({
    page,
  }) => {
    const errors = collectErrors(page)
    await page.goto("/magaza")
    const filters = page.getByRole("complementary", { name: "Filtreler" })
    const toggle = filters.getByRole("link", { name: /Yalnızca stokta olanlar/ })
    await expect(toggle).toHaveAttribute("href", "/magaza?stok=var")
    await expect(toggle).toHaveAttribute("rel", "nofollow")
    await toggle.click()
    await expect(page).toHaveURL(/\/magaza\?stok=var$/)
    expect(await robotsOf(page)).toMatch(/^noindex/)
    await expect(toggle).toHaveAttribute("aria-current", "true")
    await expect(toggle).toHaveAttribute("href", "/magaza")
    // A theme may fold the sorts into a menu (Atölye's <details>): its links stay in the page, shut
    const newest = page
      .getByRole("main")
      .getByRole("link", { name: "En yeniler", exact: true, includeHidden: true })
    await expect(newest).toHaveAttribute("href", "/magaza?stok=var&sirala=yeni")
    await page.getByRole("link", { name: "Filtreyi kaldır: Yalnızca stokta olanlar" }).click()
    await expect(page).toHaveURL(/\/magaza$/)
    await fitsThePhone(page)
    expect(errors).toEqual([])
  })
})

test.describe("blog archives (adr/0019 ek 2026-11-03)", () => {
  test("an archive no category or tag has is a 404", async ({ page }) => {
    for (const path of ["/blog/kategori/boyle-bir-kategori-yok", "/blog/etiket/boyle-etiket-yok"]) {
      expect((await page.goto(path))?.status()).toBe(404)
    }
  })
})
