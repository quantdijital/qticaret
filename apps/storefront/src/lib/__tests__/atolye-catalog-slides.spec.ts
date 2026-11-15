import { describe, expect, it } from "vitest"
import { HERO_CATALOG_SLIDER_DEFAULTS } from "@qticaret/types/section-scroller"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  HeroCatalogSlideView,
  HeroCatalogView,
  HomeSectionView,
  ImageView,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The catalogue opening's slides (adr/0049 Ek 2026-11-15): one slide is
 * today's opening to the byte, two or more turn in the tile, a slide
 * without words is its picture alone.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 800,
  height: 800,
  sources: { avif: `/media/${name}-400.avif 400w`, webp: null },
})

const catalog: HeroCatalogView = {
  list: [{ label: "Çakılar", path: "/kategori/cakilar", image: picture("cakilar"), count: 12 }],
  all: { label: "Tüm kategoriler", path: "/kategoriler" },
  tiles: [],
  chips: [],
  picks: [{ label: "Çam yeşili", path: "/urun/cam", image: picture("cam") }],
  from: "4.249,00 TL",
}

const opening = (more: Partial<HeroCatalogView> = {}): HomeSectionView => ({
  id: "giris",
  type: "hero",
  eyebrow: "Yeni sezon",
  heading: "Elmax çakılar",
  intro: "Gravürlü pirinç balçak.",
  actions: [{ label: "Çakıları gör", path: "/kategori/elmax" }],
  image: picture("elmax"),
  variant: "category_list",
  catalog: { ...catalog, ...more },
})

const own: HeroCatalogSlideView = {
  heading: "Elmax çakılar",
  intro: "Gravürlü pirinç balçak.",
  actions: [{ label: "Çakıları gör", path: "/kategori/elmax" }],
  image: picture("elmax"),
  link: null,
}
const alone: HeroCatalogSlideView = {
  heading: null,
  intro: null,
  actions: [],
  image: picture("kamp"),
  link: { label: "Kamp", path: "/kategori/kamp" },
}
const slider = { settings: HERO_CATALOG_SLIDER_DEFAULTS, interval: 6 }

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

describe("the catalogue opening's slides", () => {
  it("draws one saved slide as the opening's own fields drew it, to the byte", () => {
    expect(home([opening({ slides: [own] })])).toBe(home([opening()]))
  })

  it("turns two or more in the tile: one h1, the first picture eager and preloaded, the rest lazy", () => {
    const second = { ...own, heading: "Kamp baltaları", image: picture("balta") }
    const html = home([opening({ slides: [own, second], slider })])

    expect(html).toContain(
      'role="group" aria-roledescription="carousel" aria-label="Öne çıkan seçkiler"'
    )
    expect(html.match(/aria-roledescription="slide"/g)).toHaveLength(2)
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain(">Elmax çakılar</h1>")
    expect(html).toContain(">Kamp baltaları</h2>")
    expect(html).toMatch(/<img[^>]*alt="elmax"[^>]*loading="eager"[^>]*fetchPriority="high"/i)
    expect(html).toMatch(/<img[^>]*alt="balta"[^>]*loading="lazy"/)
    expect(html.match(/rel="preload"/g)).toHaveLength(1)
    // "From" and the products small stay with the first slide
    expect(html.match(/4\.249,00 TL/g)).toHaveLength(1)
    // The list stays put beside the stage
    expect(html.indexOf("gf-mosaic-stage")).toBeLessThan(html.indexOf("gf-mosaic-list"))
  })

  it("draws a slide without words as its picture alone, the whole of it the link", () => {
    const html = home([opening({ slides: [own, alone], slider })])

    expect(html).toContain("gf-mosaic-feature gf-mosaic-feature--whole")
    expect(html).toContain('href="/kategori/kamp" aria-label="kamp" class="absolute inset-0"')
  })

  it("keeps a hidden h1 when the first slide is a picture alone, and no carousel for one slide", () => {
    const html = home([opening({ slides: [alone] })])

    expect(html).toContain('class="sr-only">Elmax çakılar</h1>')
    expect(html).not.toContain("carousel")
    expect(html).not.toContain("Yeni sezon")
    expect(html).toMatch(/<link rel="preload" as="image" href="\/media\/kamp\.jpg"/)
  })
})
