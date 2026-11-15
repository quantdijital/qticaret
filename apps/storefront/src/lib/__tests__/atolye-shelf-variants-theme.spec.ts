import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { SCROLLER_DEFAULTS } from "@qticaret/types/section-scroller"
import type { HomeSectionView, ImageView, ProductCardView, ProductsSectionView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * A product rail's variants as the theme draws them (adr/0049 Ek
 * 2026-11-15): the carousel's row with its arrows and settings as data
 * attributes, the featured rail's large card, the compact card, the
 * columns rail's lists; and which rails join tabs.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 800,
  height: 800,
  sources: { avif: `/media/${name}-400.avif 400w`, webp: null },
})

const product = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image: picture(id),
  price: { current: "1.299,90 TL", before: "1.599,90 TL", from: false, discount: 19 },
  available: true,
  ...over,
})

const many = (count: number, over: Partial<ProductCardView> = {}) =>
  Array.from({ length: count }, (_, index) => product(`p${String(index)}`, over))

const rail = (over: Partial<ProductsSectionView> = {}): HomeSectionView => ({
  id: "raf",
  type: "products",
  title: "Yeni ürünler",
  products: many(8),
  more: { label: "Tümünü gör", path: "/kategori/raf" },
  empty: "Henüz yayında ürün yok.",
  ...over,
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

describe("the theme's product rail variants", () => {
  it("draws a carousel as one labelled row, its steps as data attributes, the arrows beside the head", () => {
    const html = home([
      rail({
        variant: "carousel",
        scroller: { ...SCROLLER_DEFAULTS, desktop: "five", arrows: "hover" },
      }),
    ])
    expect(html).toContain('role="region" aria-label="Yeni ürünler"')
    expect(html).toContain('data-desktop="five"')
    expect(html).toContain('data-mobile="peek"')
    expect(html).toContain('data-arrows="hover"')
    expect(html).toContain('data-position="head"')
    // At its start the back arrow is off; every card is in the HTML, every photo lazy
    expect(html).toMatch(/aria-label="Öncekiler"[^>]*disabled=""/)
    expect(html.match(/<li><article/g)).toHaveLength(8)
    expect(html).not.toContain('loading="eager"')
    expect(html).not.toMatch(/\sstyle="/)
  })

  it("draws no arrows when hidden, and a pause button while it turns by itself", () => {
    const html = home([
      rail({
        variant: "carousel",
        scroller: { ...SCROLLER_DEFAULTS, arrows: "hidden", autoplay: "on" },
      }),
    ])
    expect(html).not.toContain("Öncekiler")
    expect(html).toContain('aria-label="Otomatik geçişi durdur"')
  })

  it("draws a featured rail's first product large and six small ones beside it", () => {
    const html = home([rail({ variant: "featured", products: many(9) })])
    expect(html).toContain("lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]")
    expect(html.match(/<article/g)).toHaveLength(7)
    expect(html).toContain('sizes="(min-width: 1440px) 540px')
    // Its photo grows to the two rows beside it (card.css, K-07)
    expect(html.match(/class="gf-card-lead min-w-0"/g)).toHaveLength(1)
  })

  it("draws compact cards: the photo small, one link, no add button", () => {
    const html = home([rail({ variant: "compact", products: many(6, { variant: "compact" }) })])
    expect(html).toContain('sizes="(min-width: 768px) 96px, 80px"')
    expect(html).toContain("lg:grid-cols-[repeat(3,minmax(0,1fr))]")
    expect(html).toContain("%19")
    expect(html).not.toContain("quick_add")
  })

  it("draws a columns rail's lists side by side under their own headings, outside the tabs", () => {
    const lists = [
      { id: "raf-0", title: "Yeni gelenler", products: many(3, { variant: "compact" }) },
      { id: "raf-1", title: "İndirimdekiler", products: many(3, { variant: "compact" }) },
      { id: "raf-2", title: "Kampanya", products: many(3, { variant: "compact" }) },
    ]
    const html = home([
      rail({ id: "once", title: "Önce" }),
      rail({ variant: "columns", lists, perList: 3 }),
      rail({ id: "sonra", title: "Sonra" }),
    ])
    expect(html).toContain('<h2 id="bolum-raf-1"')
    // Each list's heading is a section heading, the page's one size (K-13)
    expect(html).toContain('<h2 id="bolum-raf-1">')
    expect(html).toContain("lg:grid-cols-[repeat(3,minmax(0,1fr))]")
    // The rails either side are not joined across it: no tabs at all
    expect(html).not.toContain('type="radio"')
  })

  it("joins a carousel and a grid into tabs, each panel drawn as its own", () => {
    const html = home([
      rail({ id: "bir", title: "Bir", variant: "carousel", scroller: SCROLLER_DEFAULTS }),
      rail({ id: "iki", title: "İki" }),
    ])
    expect(html.match(/type="radio"/g)).toHaveLength(2)
    expect(html).toContain('role="region"')
    expect(html).toContain('data-columns="3"')
  })
})
