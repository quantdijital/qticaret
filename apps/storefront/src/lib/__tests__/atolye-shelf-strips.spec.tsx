import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { SHELF_STRIPS_DEFAULTS } from "@qticaret/types/section-strips"
import type { HomeSectionView, ImageView, ProductCardView, ProductsSectionView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"
import { Strips } from "../../../../../packages/themes/atolye/src/parts/Strips"

/**
 * A product rail drawn as strips (adr/0049 Ek 2026-11-16): each product
 * one slanted strip, its name and price over the foot, a pill for a
 * discount or "Tükendi", the whole strip one link; the rail's head and
 * "Tümünü gör" as on every variant, and its tabs with another rail.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 800,
  height: 1000,
  sources: { avif: `/media/${name}-400.avif 400w`, webp: null },
})

const product = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: "Marka",
  image: picture(id),
  price: { current: "1.299,90 TL", before: null, from: false, discount: null },
  available: true,
  ...over,
})

const many = (count: number) =>
  Array.from({ length: count }, (_, index) => product(`p${String(index)}`))

const rail = (over: Partial<ProductsSectionView> = {}): HomeSectionView => ({
  id: "raf",
  type: "products",
  title: "Çok satanlar",
  products: many(5),
  more: { label: "Tümünü gör", path: "/kategori/raf" },
  empty: "Henüz yayında ürün yok.",
  variant: "strips",
  strips: SHELF_STRIPS_DEFAULTS,
  ...over,
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const count = (html: string, needle: string) => html.split(needle).length - 1

/** One strip's link, from its opening tag to its close. */
const linkOf = (html: string, path: string) => {
  const at = html.indexOf(`<a href="${path}" class="gf-strip-cut">`)
  return at < 0 ? "" : html.slice(at, html.indexOf("</a>", at) + 4)
}

describe("a product rail drawn as strips", () => {
  it("draws each product one linked strip under the rail's head and its link", () => {
    const html = home([rail()])
    expect(html).toContain(">Çok satanlar</h2>")
    expect(html).toContain('href="/kategori/raf"')
    expect(html).toContain('class="gf-shelf-strips"')
    expect(html).toMatch(
      /<ul class="gf-strips rounded-media [^"]*aspect-square[^"]*" data-count="5"/
    )
    expect(count(html, 'class="gf-strip-cut"')).toBe(5)
    // No card, so none of its actions: the strip is a storefront view
    expect(html).not.toContain("gf-card")
    expect(html).not.toContain("Sepete ekle")
    expect(html).not.toMatch(/\sstyle="/)
  })

  it("names each link once, by the product's name and price; the photograph says nothing more", () => {
    const html = home([rail()])
    const link = linkOf(html, "/urun/p0")
    expect(link).toContain('<span class="gf-strip-title">Ürün p0</span>')
    expect(link).toContain('<span class="gf-strip-note">1.299,90 TL</span>')
    expect(link).toContain('alt=""')
    expect(count(link, "<a ")).toBe(1)
    expect(count(html, 'href="/urun/p0"')).toBe(1)
    // The brand is the card's, not the strip's
    expect(link).not.toContain("Marka")
  })

  it("passes the look on as the shared strips' attributes, scrolling on a phone", () => {
    const html = home([
      rail({
        strips: {
          strips_height: "low",
          strips_slant: "steep",
          strips_line: "none",
          strips_overlap: "on",
          strips_dim: "off",
        },
      }),
    ])
    expect(html).toContain("aspect-[4/3] sm:aspect-[2/1] lg:aspect-[3/1]")
    expect(html).toContain('data-phone="scroll"')
    expect(html).toContain('data-slant="steep"')
    expect(html).toContain('data-line="none"')
    expect(html).toContain('data-overlap="on"')
    expect(html).not.toContain('data-dim="on"')
  })

  it("draws a rail without its look (an older storefront) with the defaults", () => {
    const html = home([rail({ strips: undefined })])
    expect(html).toContain('data-slant="medium"')
    expect(html).toContain('data-line="thin"')
    expect(html).toContain('data-dim="on"')
  })

  it("puts a discount's short pill after the words, the reader hearing it in full", () => {
    const html = home([
      rail({
        products: [
          product("p0", {
            price: { current: "1.050,00 TL", before: "1.500,00 TL", from: false, discount: 30 },
          }),
          product("p1", {
            price: { current: "900,00 TL", before: null, from: true, discount: null },
          }),
        ],
      }),
    ])
    const sale = linkOf(html, "/urun/p0")
    expect(sale).toMatch(
      /gf-strip-note">1\.050,00 TL<\/span><\/span><span class="gf-strip-flag" data-tone="deal"><span aria-hidden="true">%30<\/span><span class="sr-only">%30 indirim<\/span>/
    )
    // One short line: the struck price is the product page's
    expect(sale).not.toContain("1.500,00 TL")
    expect(linkOf(html, "/urun/p1")).toContain("900,00 TL")
    expect(linkOf(html, "/urun/p1")).toContain("başlayan")
  })

  it("marks a sold-out product as its card does, and none the shop turned off", () => {
    const html = home([
      rail({
        products: [
          product("p0", { available: false }),
          product("p1", {
            available: false,
            price: { current: "1.050,00 TL", before: "1.500,00 TL", from: false, discount: 30 },
            shown: {
              saleBadge: false,
              lowStockBadge: true,
              soldOutBadge: false,
              soldOutRow: "text",
              noReviews: "hide",
            },
          }),
        ],
      }),
    ])
    const out = linkOf(html, "/urun/p0")
    expect(out).toContain('data-tone="out">Tükendi</span>')
    expect(out).toContain("1.299,90 TL")
    // No pill, no price: "Tükendi" in the price's place
    const quiet = linkOf(html, "/urun/p1")
    expect(quiet).not.toContain("gf-strip-flag")
    expect(quiet).toContain('<span class="gf-strip-note">Tükendi</span>')
  })

  it("keeps a product without a photograph as its strip's well under its words", () => {
    const html = home([rail({ products: [product("p0", { image: null }), product("p1")] })])
    const bare = linkOf(html, "/urun/p0")
    expect(bare).not.toContain("<img")
    expect(bare).toContain('<span class="gf-strip-title">Ürün p0</span>')
    expect(html).toContain('data-count="2"')
  })

  it("loads every photograph lazily, sized for a strip", () => {
    const html = home([rail({ products: many(8) })])
    expect(html).toContain('data-count="8"')
    expect(html).not.toContain('loading="eager"')
    expect(html).toMatch(/sizes="\(min-width: 1024px\) \d+vw/)
  })

  it("joins another rail's tabs, its head the tab row's", () => {
    const html = home([rail(), rail({ id: "raf2", title: "Yeni ürünler", variant: "grid" })])
    expect(html).toContain('class="gf-tabs')
    expect(html).toContain(">Çok satanlar</label>")
    expect(html).toContain('<h2 id="bolum-raf" class="sr-only">Çok satanlar</h2>')
    expect(count(html, 'class="gf-strip-cut"')).toBe(5)
  })

  it("shows the rail's empty words with nothing to draw", () => {
    const html = home([rail({ products: [] })])
    expect(html).toContain("Henüz yayında ürün yok.")
    expect(html).not.toContain("gf-strips")
  })
})

describe("the strips' pill and missing photograph (the shared core)", () => {
  it("draws a pill's text alone when the reader hears the same", () => {
    const html = renderToStaticMarkup(
      <Strips
        items={[{ key: "a", image: null, flag: { tone: "out", text: "Tükendi" } }]}
        look={{ slant: "soft", line: "medium", overlap: false, dim: false }}
        span={92}
        className="h-40"
      />
    )
    expect(html).toContain('<span class="gf-strip-flag" data-tone="out">Tükendi</span>')
    expect(html).not.toContain("<img")
  })
})
