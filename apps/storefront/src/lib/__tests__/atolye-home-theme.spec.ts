import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ImageView, ProductCardView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The Atölye home page (design.md: Bento Grid, hero Index) as the server
 * prints it from the shop's own sections: the opening takes the categories
 * that follow it as its bento, and nothing is drawn that the shop did not
 * give.
 */

const image: ImageView = {
  src: "/media/caki-800.jpg",
  alt: "Ahşap saplı çakı",
  width: 800,
  height: 800,
  sources: { avif: "/media/caki-400.avif 400w", webp: null },
}

const product = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image,
  price: { current: "449,00 TL", before: null, from: false, discount: null },
  available: true,
  ...over,
})

const hero: HomeSectionView = {
  id: "giris",
  type: "hero",
  eyebrow: "Kısa üst satır",
  heading: "El yapımı ürünler",
  intro: "Her modelde ölçü ve malzeme yazılı.",
  actions: [
    { label: "Ürünleri incele", path: "/kategori/urunler" },
    { label: "Koleksiyon", path: "/kategori/koleksiyon" },
  ],
  image: null,
}

const categories = (count: number): HomeSectionView => ({
  id: "kategoriler",
  type: "categories",
  title: "Kategorilere göz atın",
  categories: Array.from({ length: count }, (_, index) => ({
    label: `Kategori ${String(index + 1)}`,
    path: `/kategori/k${String(index + 1)}`,
  })),
})

const shelf: HomeSectionView = {
  id: "yeni",
  type: "products",
  title: "Yeni ürünler",
  products: [product("a", { image: null }), product("b")],
  more: { label: "Tüm ürünler", path: "/magaza" },
  empty: "Henüz ürün yok.",
}

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

describe("the Atölye opening", () => {
  it("is the page's one h1, with the shop's line and its two actions, and no eyebrow", () => {
    const html = home([hero, categories(3), shelf])

    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain(">El yapımı ürünler</h1>")
    expect(html).toContain("Her modelde ölçü ve malzeme yazılı.")
    expect(html).toMatch(/<a href="\/kategori\/urunler" class="at-btn">Ürünleri incele<\/a>/)
    expect(html).toMatch(/<a href="\/kategori\/koleksiyon" class="at-btn at-btn--quiet">/)
    expect(html).not.toContain("Kısa üst satır")
  })

  it("lists the first six categories in the opening for a phone, then every one in the index", () => {
    const html = home([hero, categories(8), shelf])

    const opening = html.slice(0, html.indexOf('id="bolum-kategoriler"'))
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(opening).toContain(`href="/kategori/k${String(n)}"`)
    }
    expect(opening).not.toContain('href="/kategori/k7"')
    expect(html).toMatch(/<nav aria-label="Kategorilere göz atın" class="[^"]*lg:hidden/)
    expect(html).toContain('<h2 id="bolum-kategoriler">Kategorilere göz atın</h2>')
    const index = html.slice(html.indexOf('id="bolum-kategoriler"'))
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(index).toContain(`href="/kategori/k${String(n)}"`)
    }
    // A phone has the first six in the opening already
    expect(index.match(/max-lg:hidden/g)).toHaveLength(6)
    expect(html).toContain('href="/kategoriler"')
  })

  it("keeps the index off a phone when the opening already lists every category", () => {
    const html = home([hero, categories(4), shelf])

    expect(html).toMatch(/<div class="max-lg:hidden"><section aria-labelledby="bolum-kategoriler"/)
  })

  it("shows the shop's first pictured product as its photograph, loaded first", () => {
    const html = home([hero, categories(5), shelf])

    expect(html).toMatch(/<a href="\/urun\/b" aria-label="Ürün b"/)
    expect(html).toContain('fetchPriority="high"')
    expect(html).not.toContain('href="/urun/a" aria-label')
  })

  it("prefers the shop's own opening picture, linked to its first action", () => {
    const html = home([{ ...hero, image: { ...image, alt: "Atölye" } }, categories(2), shelf])

    expect(html).toMatch(/<a href="\/kategori\/urunler" aria-label="Ürünleri incele"/)
  })

  it("draws no picture it was not given", () => {
    const html = home([hero, categories(3)])

    expect(html).not.toContain("<picture")
    expect(html).not.toContain("<img")
  })
})

describe("the Atölye home page without an opening", () => {
  it("keeps one h1 for the reader", () => {
    const html = home([shelf])

    expect(html).toContain('<h1 class="sr-only">Ana sayfa</h1>')
  })
})
