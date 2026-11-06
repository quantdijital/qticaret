import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { CategoriesPageView, CategoryTreeView, ImageView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The Grafit theme's category index (`/kategoriler`): a compact head with
 * what the shop holds, each top category with ones below it a section of
 * picture tiles (its small picture, name, count and "Tümünü gör" in the
 * head), the top categories with none below them together in one last
 * row; every category a picture tile with its count, never a text list.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 800,
  height: 1000,
  sources: { avif: null, webp: null },
})

const node = (
  path: string,
  label: string,
  over: Partial<CategoryTreeView> = {}
): CategoryTreeView => ({ label, path, image: picture(path.slice(1)), children: [], ...over })

const view = (over: Partial<CategoriesPageView> = {}): CategoriesPageView => ({
  title: "Kategoriler",
  breadcrumbs: [
    { label: "Ana sayfa", path: "/" },
    { label: "Kategoriler", path: null },
  ],
  categories: [
    node("/cakilar", "Çakılar", {
      count: 1240,
      children: [
        node("/cakilar/katlanir", "Katlanır", { count: 12 }),
        node("/cakilar/sabit", "Sabit", { image: null, count: 0 }),
      ],
    }),
    node("/av", "Av bıçağı", { count: 24 }),
    node("/bahce", "Bahçe", { count: 6 }),
  ],
  total: 1300,
  ...over,
})

const page = (over: Partial<CategoriesPageView> = {}) =>
  renderPage(atolyeTheme, "CategoriesPage", { view: view(over) })

describe("the theme's category index", () => {
  it("opens with the trail, one h1 at the page size and one line of what the shop holds", () => {
    const html = page()
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain("<h1>Kategoriler</h1>")
    expect(html).toContain('aria-current="page"')
    expect(html).toContain("1.300 ürün, 5 kategoride.")
  })

  it("says only the categories when the products were not counted", () => {
    expect(page({ total: null })).toContain(">5 kategori</p>")
  })

  it("gives a top category with ones below it a section: picture, h2, count and its page", () => {
    const html = page()
    expect(html).toMatch(/<section aria-labelledby="kategori-cakilar"/)
    expect(html).toMatch(/<h2 id="kategori-cakilar"[^>]*>Çakılar<\/h2>/)
    expect(html).toContain(">1.240 ürün</span>")
    expect(html).toContain('src="/media/cakilar.jpg"')
    expect(html).toContain('aria-label="Tümünü gör: Çakılar"')
  })

  it("draws every category below as a picture tile with its count; an empty one without", () => {
    const html = page()
    expect(html).toMatch(/href="\/cakilar\/katlanir" class="gf-stage[^"]*aspect-\[4\/5\]/)
    expect(html).toContain('src="/media/cakilar/katlanir.jpg"')
    expect(html).toContain(">12 ürün</span>")
    expect(html).toMatch(/href="\/cakilar\/sabit" class="gf-stage[^"]*aspect-\[4\/5\]/)
    expect(html).not.toContain(">0 ürün<")
    // Never the old text list of names
    expect(html).not.toContain("border-l")
  })

  it("puts the top categories with none below them together in one last row of tiles", () => {
    const html = page()
    expect(html).toContain('<h2 id="kategori-diger">Diğer kategoriler</h2>')
    expect(html).toMatch(/href="\/av" class="gf-stage[^"]*aspect-\[4\/5\]/)
    expect(html).toMatch(/href="\/bahce" class="gf-stage[^"]*aspect-\[4\/5\]/)
    expect(html.indexOf('id="kategori-diger"')).toBeGreaterThan(
      html.indexOf('id="kategori-cakilar"')
    )
  })

  it("keeps the last row's heading for a reader alone when no category has ones below it", () => {
    const html = page({ categories: [node("/av", "Av bıçağı")] })
    expect(html).toContain('<h2 id="kategori-diger" class="sr-only">Tüm kategoriler</h2>')
  })

  it("says so when there is no category yet", () => {
    const html = page({ categories: [], total: 0 })
    expect(html).toContain("Henüz yayında kategori yok.")
    expect(html).not.toContain("<section")
  })
})
