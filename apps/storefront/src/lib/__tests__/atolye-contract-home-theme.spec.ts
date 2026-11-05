import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  ActionResult,
  CategoryCardView,
  HomeSectionView,
  ImageView,
  ProductCardView,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The Atölye home page with the contract's optional fields (adr/0046 Ek
 * 2026-11-04): category pictures, a card's stock bucket and quick add,
 * review photos and the customers' photos. Each is drawn only when it
 * comes; without it the page is the one it was.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 800,
  height: 800,
  sources: { avif: null, webp: null },
})

const categories = (count: number, pictured: number): HomeSectionView => ({
  id: "kategoriler",
  type: "categories",
  title: "Kategoriler",
  categories: Array.from({ length: count }, (_, index): CategoryCardView => ({
    label: `Kategori ${String(index + 1)}`,
    path: `/kategori/k${String(index + 1)}`,
    ...(index < pictured ? { image: picture(`k${String(index + 1)}`) } : {}),
  })),
})

const hero: HomeSectionView = {
  id: "giris",
  type: "hero",
  eyebrow: null,
  heading: "El yapımı ürünler",
  intro: null,
  actions: [{ label: "Ürünleri incele", path: "/magaza" }],
  image: null,
}

const product = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image: null,
  price: { current: "449,00 TL", before: null, from: false, discount: null },
  available: true,
  ...over,
})

const shelf = (products: ProductCardView[]): HomeSectionView => ({
  id: "yeni",
  type: "products",
  title: "Yeni ürünler",
  products,
  more: null,
  empty: "Henüz ürün yok.",
})

const quickAdd = (): Promise<ActionResult> => Promise.resolve({ ok: true, error: null })

const home = (sections: HomeSectionView[], withQuickAdd = false) =>
  renderPage(atolyeTheme, "HomePage", {
    view: { sections },
    ...(withQuickAdd ? { quickAdd } : {}),
  })

/** The categories section's own HTML (the opening lists names too). */
const index = (html: string) => html.slice(html.indexOf('id="bolum-kategoriler"'))

describe("the Atölye category index with the shop's pictures", () => {
  it("stays the ruled index, with no picture box, when no category has a picture", () => {
    const html = index(home([hero, categories(8, 0)]))

    expect(html).not.toContain("<img")
    expect(html).toContain("sm:grid-cols-2 xl:grid-cols-3")
    expect(home([hero, categories(4, 0)])).toMatch(
      /<section aria-labelledby="bolum-kategoriler" class="[^"]*max-lg:hidden/
    )
  })

  it("draws five as a bento with a lead, the rest as ruled rows, each category once", () => {
    const html = index(home([hero, categories(14, 11)]))

    expect(html.match(/<img/g)).toHaveLength(5)
    expect(html).toContain("lg:grid-cols-4")
    expect(html).toContain("lg:col-span-2 lg:row-span-2")
    // The picture is decoration: the name in the same link says what it is
    expect(html).toContain('alt=""')
    expect(html).toContain('loading="lazy"')
    for (let n = 1; n <= 14; n += 1) {
      expect(html.match(new RegExp(`href="/kategori/k${String(n)}"`, "g"))).toHaveLength(1)
    }
    // A pictured sixth keeps its row, by name: the index stays the index
    expect(html).toMatch(/href="\/kategori\/k6" class="at-row-link/)
  })

  it("names a tile in the rows' own voice: the display face at 32 px from 1024 px", () => {
    const html = index(home([hero, categories(10, 5)]))

    expect(html).toMatch(
      /<span class="text-lg font-medium lg:font-display lg:text-tile[^"]*">Kategori 1<\/span>/
    )
  })

  it("stands a row of three or four, and one or two beside the rows", () => {
    const three = index(home([hero, categories(10, 3)]))
    expect(three.match(/<img/g)).toHaveLength(3)
    expect(three).toContain("lg:grid-cols-3")
    expect(three).not.toContain("lg:row-span-2")

    const two = index(home([hero, categories(10, 2)]))
    expect(two.match(/<img/g)).toHaveLength(2)
    expect(two).toContain("lg:col-span-5")
    expect(two).toContain("lg:col-span-7")
  })

  it("keeps a phone's tiles to the categories the opening does not name", () => {
    const html = index(home([hero, categories(10, 8)]))

    // The first five are tiles; the opening names the first six on a phone
    expect(
      html.match(/<li class="max-lg:hidden[^"]*"><a href="\/kategori\/k[1-5]" class="at-tile/g)
    ).toHaveLength(5)
    // With no tile left for a phone, the tiles' rule stays away there too
    expect(html).toMatch(/<ul class="[^"]*max-lg:hidden[^"]*lg:grid-cols-4/)
    // Every name in the opening already: the section stays off a phone, pictures or not
    expect(home([hero, categories(4, 4)])).toMatch(
      /<section aria-labelledby="bolum-kategoriler" class="[^"]*max-lg:hidden/
    )
  })

  it("gives an odd count of a phone's tiles a first one the whole width", () => {
    const html = index(home([{ ...categories(5, 5), id: "kategoriler" }]))

    expect(html).toContain('class="max-lg:col-span-2 lg:col-span-2 lg:row-span-2"')
  })
})

describe("the Atölye product card's stock and quick add", () => {
  it("says few left or sold out in words, never a number, and nothing when in stock", () => {
    const html = home([
      shelf([
        product("a", { stock: "low" }),
        product("b", { stock: "out" }),
        product("c", { stock: "in_stock" }),
      ]),
    ])

    expect(html.match(/Az kaldı/g)).toHaveLength(1)
    expect(html.match(/Tükendi/g)).toHaveLength(1)
    expect(html).not.toMatch(/\d+ adet/)
  })

  it("posts the one variant, quantity 1, with a 44 px secondary button named for the product", () => {
    const html = home([shelf([product("a", { quickAdd: { variantId: "variant_a" } })])], true)

    expect(html).toContain('name="variant_id" value="variant_a"')
    expect(html).toContain('name="quantity" value="1"')
    expect(html).toMatch(/<button type="submit" class="at-btn at-btn--quiet min-h-11 w-full/)
    expect(html).toContain('aria-label="Ürün a ürününü sepete ekle"')
    expect(html).toContain(">Ekle</button>")
    expect(html).toContain('role="alert"')
  })

  it("has no quick add without the page's action, on a sold-out card, or without a variant", () => {
    const view = shelf([product("a", { quickAdd: { variantId: "variant_a" } })])
    expect(home([view])).not.toContain('name="variant_id"')

    const out = shelf([product("b", { stock: "out", quickAdd: { variantId: "variant_b" } })])
    expect(home([out], true)).not.toContain('name="variant_id"')

    const none = home([shelf([product("c"), product("d", { quickAdd: null })])], true)
    expect(none).not.toContain('name="variant_id"')
    // A grid without a quick add keeps its rows as they were
    expect(none).not.toContain("grid-rows-subgrid")
  })

  it("lines a row's cards up on shared rows when one of them has a quick add", () => {
    const html = home(
      [shelf([product("a", { quickAdd: { variantId: "variant_a" } }), product("b")])],
      true
    )

    expect(html.match(/<li class="row-span-3 grid grid-rows-subgrid gap-y-3">/g)).toHaveLength(2)
  })

  it("shows the stars when the card has them", () => {
    const rated = product("a", {
      rating: { average: "4,8", count: 12, label: "5 üzerinden 4,8 (12 değerlendirme)" },
    })

    expect(home([shelf([rated])])).toContain("5 üzerinden 4,8 (12 değerlendirme)")
    expect(home([shelf([product("b")])])).not.toContain("değerlendirme")
  })
})

const review = (n: number, over: Record<string, unknown> = {}) => ({
  rating: 5,
  title: null,
  body: "Elime ulaştı, çok beğendim.",
  author: `Müşteri ${String(n)}`,
  date: "2 Kasım 2026",
  verified: true,
  product: { label: `Ürün ${String(n)}`, path: `/urun/${String(n)}` },
  ...over,
})

const reviews = (over: Partial<Extract<HomeSectionView, { type: "reviews" }>> = {}) =>
  ({
    id: "yorum",
    type: "reviews",
    title: "Müşteri yorumları",
    more: { label: "Tüm yorumlar", path: "/yorumlar" },
    reviews: [review(1)],
    ...over,
  }) as HomeSectionView

describe("the Atölye reviews section with photos", () => {
  it("shows a review's own photos, each opening the full picture", () => {
    const html = home([
      reviews({
        reviews: [review(1, { photos: [{ image: picture("yorum-1") }] })],
      }),
    ])

    expect(html).toContain('aria-label="Yorumdaki fotoğraflar"')
    expect(html).toMatch(/<a href="\/media\/yorum-1.jpg" target="_blank" rel="noopener"/)
    expect(html).toContain('alt="yorum-1"')
  })

  it("adds the customers' photos, lazy, each named by who took it and of which product", () => {
    const html = home([
      reviews({
        photos: [
          {
            image: picture("p1"),
            product: { label: "Çakı", path: "/urun/caki" },
            rating: 5,
            author: "Ayşe K.",
          },
          { image: picture("p2"), product: null, rating: 4, author: "Ali V." },
        ],
      }),
    ])

    expect(html).toContain(">Müşteri fotoğrafları</h3>")
    expect(html).toContain('alt="Ayşe K. adlı müşterinin fotoğrafı: Çakı"')
    expect(html).toMatch(/<a href="\/urun\/caki" class="at-tile/)
    // No live page for its product: the picture and whose it is, no link
    expect(html).toContain("<figcaption")
    expect(html).toContain(">Ali V.</figcaption>")
    expect(html.match(/loading="lazy"/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it("leaves a quoted review's photos out of the strip", () => {
    const shared = picture("ortak")
    const strip = (author: string, image: ImageView) => ({
      image,
      product: null,
      rating: 5,
      author,
    })
    const html = home([
      reviews({
        reviews: [review(1, { photos: [{ image: shared }] })],
        photos: [strip("Müşteri 1", shared), strip("Ali V.", picture("diger"))],
      }),
    ])

    expect(html.match(/\/media\/ortak\.jpg/g)).toHaveLength(2)
    expect(html).toContain(">Ali V.</figcaption>")
    expect(html).not.toContain(">Müşteri 1</figcaption>")
    // Nothing left for the strip: no strip
    const only = home([
      reviews({
        reviews: [review(1, { photos: [{ image: shared }] })],
        photos: [strip("Müşteri 1", shared)],
      }),
    ])
    expect(only).not.toContain("Müşteri fotoğrafları")
  })

  it("draws no strip without photos, and no section without a review", () => {
    expect(home([reviews()])).not.toContain("Müşteri fotoğrafları")
    expect(home([reviews({ photos: [] })])).not.toContain("Müşteri fotoğrafları")
    expect(home([reviews({ reviews: [] })])).not.toContain("Müşteri yorumları")
  })

  it("quotes three reviews, each from its first words, never more than they said", () => {
    const long = Array.from({ length: 30 }, (_, n) => `kelime${String(n)}`).join(" ")
    const html = home([
      reviews({ reviews: [review(1, { body: long }), review(2), review(3), review(4)] }),
    ])

    expect(html).toContain("kelime11…")
    expect(html).not.toContain("kelime12")
    expect(html).toContain("Elime ulaştı, çok beğendim.")
    expect(html).not.toContain("Müşteri 4")
  })
})
