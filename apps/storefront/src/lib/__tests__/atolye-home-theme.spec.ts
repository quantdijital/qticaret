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
 * The theme's home page (docs/tema/yon-2026-11-05.md § Home) from the
 * shop's own sections, in its order: the opening on its graphite stage,
 * the promises, the category tiles, one tabbed shelf for neighbouring
 * product sections. Nothing is drawn that the shop did not give.
 */

const picture = (name: string, avif = false): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 800,
  height: 800,
  sources: { avif: avif ? `/media/${name}-400.avif 400w` : null, webp: null },
})

const product = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image: picture(id, true),
  price: { current: "1.299,90 TL", before: null, from: false, discount: null },
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

const shelf = (
  id: string,
  title: string,
  products: ProductCardView[],
  columns?: 3 | 4 | 5
): HomeSectionView => ({
  id,
  type: "products",
  title,
  products,
  more: { label: "Tümünü gör", path: `/kategori/${id}` },
  empty: "Henüz yayında ürün yok.",
  ...(columns ? { columns } : {}),
})

const many = (count: number, prefix = "p") =>
  Array.from({ length: count }, (_, index) => product(`${prefix}${String(index)}`))

/** Each card's `<li>` classes in a grid of cards-in-a-row, in order. */
const cardClasses = (html: string, columns: number) => {
  // Up to the next grid: a card holds its own list of pills
  const grid = html.split(`data-columns="${String(columns)}"`)[1]?.split("data-columns=")[0] ?? ""
  return [...grid.matchAll(/<li class="([^"]*)"><article/g)].map((match) => match[1])
}

const categories = (count: number, pictured: number): HomeSectionView => ({
  id: "kategoriler",
  type: "categories",
  title: "Kategorilere göz atın",
  categories: Array.from({ length: count }, (_, index): CategoryCardView => ({
    label: `Kategori ${String(index + 1)}`,
    path: `/kategori/k${String(index + 1)}`,
    ...(index < pictured ? { image: picture(`k${String(index + 1)}`) } : {}),
  })),
})

const home = (sections: HomeSectionView[], quickAdd?: () => Promise<ActionResult>) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections }, ...(quickAdd ? { quickAdd } : {}) })

describe("the theme's home page: opening, promises, aisles", () => {
  it("makes the hero the one h1, with its line and its first action, no eyebrow", () => {
    const html = home([hero, shelf("yeni", "Yeni ürünler", [product("a")])])
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain(">El yapımı ürünler</h1>")
    expect(html).toContain("Her modelde ölçü ve malzeme yazılı.")
    expect(html).toContain('href="/kategori/urunler"')
    expect(html).not.toContain("Koleksiyon")
    expect(html).not.toContain("Kısa üst satır")
  })

  it("shows the shop's newest pictured product on the stage, first and preloaded", () => {
    const html = home([
      hero,
      shelf("yeni", "Yeni ürünler", [product("a", { image: null }), product("b")]),
    ])
    expect(html).toMatch(/<link rel="preload" as="image" href="\/media\/b\.jpg"/)
    expect(html).toContain('imageSrcSet="/media/b-400.avif 400w"')
    expect(html).toMatch(/src="\/media\/b\.jpg"[^>]*loading="eager"[^>]*fetchPriority="high"/)
  })

  it("prints the page's h1 for the reader when the shop's page opens with no hero", () => {
    const html = home([shelf("yeni", "Yeni ürünler", [product("a")])])
    expect(html).toContain('<h1 class="sr-only">Ana sayfa</h1>')
    expect(html).not.toContain('rel="preload"')
  })

  it("lists the shop's promises with their own words", () => {
    const html = home([
      hero,
      {
        id: "guven",
        type: "trust_badges",
        badges: [{ icon: "truck", title: "Ücretsiz kargo", text: "1.500,00 TL ve üzeri" }],
      },
    ])
    expect(html).toContain("Ücretsiz kargo")
    expect(html).toContain("1.500,00 TL ve üzeri")
    // On a phone equal cards, the icon over the title; from 640 px beside it
    expect(html).toContain("auto-rows-fr")
    expect(html).toContain("flex-col items-start")
    expect(html).toContain("sm:flex-row")
  })

  it("draws every category as a tile of one size, no pills, and the link to every category", () => {
    const html = home([hero, categories(13, 13)])
    expect(html.match(/href="\/kategori\/k\d+"/g)).toHaveLength(13)
    expect(html.match(/aspect-\[4\/5\]/g)).toHaveLength(13)
    expect(html).not.toContain("gf-chip")
    expect(html.match(/src="\/media\/k\d+\.jpg"/g)).toHaveLength(13)
    expect(html).toContain('href="/kategoriler"')
  })

  it("lays the tiles in a row that scrolls on a phone and in columns that fit the count from 1024 px", () => {
    const thirteen = home([hero, categories(13, 13)])
    expect(thirteen).toContain("grid-flow-col")
    expect(thirteen).toContain("lg:grid-cols-5")
    expect(thirteen).toContain("xl:grid-cols-7")
    const eight = home([hero, categories(8, 8)])
    expect(eight).toContain("lg:grid-cols-4")
    expect(eight).toContain("xl:grid-cols-4")
    // Six fill two rows of three, then one row of six; seven, four over three, then one row
    const six = home([hero, categories(6, 6)])
    expect(six).toContain("lg:grid-cols-3")
    expect(six).toContain("xl:grid-cols-6")
    const seven = home([hero, categories(7, 7)])
    expect(seven).toContain("lg:grid-cols-4")
    expect(seven).toContain("xl:grid-cols-7")
  })

  it("keeps a category without any picture a tile of the same size, its name on the graphite", () => {
    const html = home([hero, categories(4, 0)])
    expect(html.match(/aspect-\[4\/5\]/g)).toHaveLength(4)
    expect(html).not.toContain('src="/media/k')
    expect(html).toContain(">Kategori 4</span>")
  })
})

describe("the theme's home page: the shelf", () => {
  it("joins neighbouring product sections into script-free tabs, every panel in the HTML", () => {
    const html = home([
      hero,
      shelf("yeni", "Yeni ürünler", [product("a")]),
      shelf("caki", "Çakılar", [product("c")]),
    ])
    expect(html.match(/type="radio"/g)).toHaveLength(2)
    expect(html).toMatch(/checked="" value="0"/)
    expect(html).toContain('data-panel="1"')
    expect(html).toContain('href="/urun/c"')
    expect(html).toContain('href="/kategori/caki"')
  })

  it("starts the tabs and the tiles on the page's left line, though their rows run to the screen's edges", () => {
    const html = home([
      hero,
      categories(8, 8),
      shelf("cok", "Çok satanlar", [product("a")]),
      shelf("yeni", "Yeni gelenler", [product("b")]),
    ])
    const rails = html.match(/class="gf-rail [^"]*"/g) ?? []
    expect(rails).toHaveLength(2)
    // Past the container by the gutter, padded and snapping at the gutter: the
    // mandatory snap would otherwise pull the first pill onto the screen's edge
    for (const rail of rails) {
      expect(rail).toContain("-mx-(--gutter)")
      expect(rail).toContain("px-(--gutter)")
      expect(rail).toContain("scroll-px-(--gutter)")
    }
  })

  it("keeps a lone product section a plain grid under its heading, six cards at most", () => {
    const products = Array.from({ length: 8 }, (_, index) => product(`p${String(index)}`))
    const html = home([hero, shelf("yeni", "Yeni ürünler", products)])
    expect(html).not.toContain('type="radio"')
    expect(html).toContain(">Yeni ürünler</h2>")
    expect(html.match(/<article/g)).toHaveLength(6)
  })

  it("keeps three across, six cards, when the shop chose nothing (the look before the setting)", () => {
    const html = home([hero, shelf("yeni", "Yeni ürünler", many(12))])
    expect(html).toContain('data-columns="3"')
    expect(html).not.toContain("xl:grid-cols-[repeat(")
    expect(cardClasses(html, 3)).toEqual(Array.from({ length: 6 }, () => "min-w-0"))
    expect(html).toContain('sizes="(min-width: 1440px) 432px, (min-width: 768px) 30vw, 46vw"')
  })

  it("lays five across from 1280 px, four from 1024, three from 768, two rows of each", () => {
    const html = home([hero, shelf("cok", "Çok satanlar", many(12), 5)])
    expect(html).toContain(
      "lg:grid-cols-[repeat(4,minmax(0,1fr))] xl:grid-cols-[repeat(5,minmax(0,1fr))]"
    )
    // Ten drawn; a phone and a tablet show six, 1024 px eight, 1280 px ten
    expect(cardClasses(html, 5)).toEqual([
      ...Array.from({ length: 6 }, () => "min-w-0"),
      "min-w-0 hidden lg:block",
      "min-w-0 hidden lg:block",
      "min-w-0 hidden xl:block",
      "min-w-0 hidden xl:block",
    ])
    expect(html).toContain('sizes="(min-width: 1440px) 250px, (min-width: 1280px) 18vw')
  })

  it("shows whole rows only when the products do not fill two", () => {
    // Seven at five across: one row of five, four at 1024 px, six on a tablet and a phone
    const html = home([hero, shelf("cok", "Çok satanlar", many(7), 5)])
    expect(cardClasses(html, 5)).toEqual([
      "min-w-0",
      "min-w-0",
      "min-w-0",
      "min-w-0",
      "min-w-0 lg:hidden xl:block",
      "min-w-0 lg:hidden",
    ])
    // Fewer than a row: all of them
    expect(cardClasses(home([hero, shelf("az", "Az", many(2), 4)]), 4)).toHaveLength(2)
  })

  it("lets each tab keep its own cards in a row", () => {
    const html = home([
      hero,
      shelf("cok", "Çok satanlar", many(12, "c"), 5),
      shelf("yeni", "Yeni gelenler", many(12, "y"), 4),
      shelf("indirim", "İndirimde", many(12, "i")),
    ])
    expect(html.match(/type="radio"/g)).toHaveLength(3)
    expect(cardClasses(html, 5)).toHaveLength(10)
    expect(cardClasses(html, 4)).toEqual([
      ...Array.from({ length: 6 }, () => "min-w-0"),
      "min-w-0 hidden xl:block",
      "min-w-0 hidden xl:block",
    ])
    expect(cardClasses(html, 3)).toHaveLength(6)
  })

  it("marks a discount, stock and the quick add only as the card's view says", () => {
    const html = home(
      [
        hero,
        shelf("yeni", "Yeni ürünler", [
          product("a", {
            price: { current: "910,00 TL", before: "1.300,00 TL", from: false, discount: 30 },
            stock: "low",
            quickAdd: { variantId: "variant_a" },
          }),
          product("b", { available: false, quickAdd: { variantId: "variant_b" } }),
        ]),
      ],
      () => Promise.resolve({ ok: true, error: null })
    )
    expect(html).toContain("%30 indirim")
    expect(html).toContain("1.300,00 TL")
    expect(html).toContain("Az kaldı")
    expect(html).toContain("Tükendi")
    expect(html).toContain('value="variant_a"')
    expect(html).not.toContain('value="variant_b"')
    expect(html).toContain('aria-label="Ürün a ürününü sepete ekle"')
  })
})
