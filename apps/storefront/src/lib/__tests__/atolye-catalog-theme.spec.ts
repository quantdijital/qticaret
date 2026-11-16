import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { CategoryCardView, HomeSectionView, ImageView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The catalogue home page's sections in Atölye (adr/0049 Ek 2026-11-14
 * §3.2 H17 and the note "Katalog ana sayfası"): the opening's category
 * list, the price bands, the category cards' counts.
 */

const picture = (name: string): ImageView => ({
  src: `/media/${name}.jpg`,
  alt: name,
  width: 800,
  height: 800,
  sources: { avif: `/media/${name}-400.avif 400w`, webp: null },
})

const category = (name: string, count?: number): CategoryCardView => ({
  label: name,
  path: `/kategori/${name.toLowerCase()}`,
  image: picture(name.toLowerCase()),
  ...(count === undefined ? {} : { count }),
})

const opening = (
  over: Partial<Extract<HomeSectionView, { type: "hero" }>> = {}
): HomeSectionView => ({
  id: "giris",
  type: "hero",
  eyebrow: null,
  heading: "Stabilize ahşap saplı Elmax çakılar",
  intro: "Gravürlü pirinç balçak, dört renk.",
  actions: [{ label: "Elmax çakıları gör", path: "/kategori/elmax" }],
  image: picture("elmax"),
  variant: "category_list",
  catalog: {
    list: [category("Çakılar", 1240), category("Kılıçlar", 14), category("Hediyelik")],
    all: { label: "Tüm kategoriler", path: "/kategoriler" },
    tiles: [category("Baltalar", 13), category("Şef")],
    chips: [
      { label: "Minyatür kılıçlar", path: "/kategori/minyatur", image: picture("minyatur") },
      { label: "Kampanyalar", path: "/kampanyalar" },
    ],
    picks: [{ label: "Çam yeşili", path: "/urun/cam", image: picture("cam") }],
    from: "4.249,00 TL",
  },
  ...over,
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

describe("the catalogue opening (H17)", () => {
  it("draws the opening first as the page's h1 with its picture preloaded", () => {
    const html = home([opening()])

    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain(">Stabilize ahşap saplı Elmax çakılar</h1>")
    expect(html).toMatch(/<link rel="preload" as="image" href="\/media\/elmax\.jpg"/)
    // The opening comes before the list in the HTML; the list is a named navigation
    expect(html.indexOf("gf-mosaic-feature")).toBeLessThan(html.indexOf("gf-mosaic-list"))
    expect(html).toContain('<nav aria-label="Kategoriler" class="gf-mosaic-list">')
  })

  it("keeps the words the shop wrote for its picture, and preloads one picture only", () => {
    const html = home([opening(), opening({ id: "ikinci", variant: "standard" })])

    expect(html).toMatch(/<img[^>]*alt="elmax"/)
    expect(html.match(/rel="preload"/g)).toHaveLength(1)
  })

  it("lists the categories with their counts, the tiles with theirs, a missing count left out", () => {
    const html = home([opening()])

    expect(html).toContain('<span aria-hidden="true">1.240</span>')
    expect(html).toContain('<span class="sr-only">1.240 ürün</span>')
    expect(html).toContain(">13 ürün</span>")
    expect(html.match(/gf-mosaic-count/g)).toHaveLength(2)
    expect(html).toContain('href="/kategoriler"')
  })

  it("shows the lowest price, the button, the products small and the quick links", () => {
    const html = home([opening()])

    expect(html).toContain(">4.249,00 TL</b>")
    expect(html).toContain("başlangıç fiyatı")
    expect(html).toContain('href="/kategori/elmax" class="gf-btn"')
    expect(html).toContain(">Çam yeşili</span>")
    expect(html).toContain('aria-label="Hızlı bağlantılar"')
    expect(html).toContain(">Kampanyalar</a>")
    // A long category name wraps rather than losing its end (K-15)
    expect(html).toContain('class="line-clamp-3 leading-snug break-words"')
    expect(html).not.toMatch(/gf-mosaic-row[^>]*>(?:(?!<\/a>).)*class="truncate"/)
  })

  it("draws today's opening when the variant is not the category list or its parts did not come", () => {
    const plain = home([opening({ variant: "standard" })])
    const partless = home([opening({ catalog: null })])

    for (const html of [plain, partless]) {
      expect(html).not.toContain("gf-mosaic")
      expect(html).toContain("gf-stage")
    }
  })
})

/** Each price band card's top-level parts, by their class, in drawing order. */
const cardParts = (html: string): string[][] =>
  [...html.matchAll(/<a href="[^"]*" class="group flex h-full[^"]*">(.*?)<\/a>/gs)].map(
    ([, inside = ""]) => {
      const parts: string[] = []
      let depth = 0
      for (const [, closing, attributes = ""] of inside.matchAll(
        /<(\/?)(?:span|picture)([^>]*)>/g
      )) {
        if (closing) {
          depth -= 1
          continue
        }
        if (depth === 0) parts.push(/class="([^"]*)"/.exec(attributes)?.[1] ?? "")
        depth += 1
      }
      return parts
    }
  )

describe("the price bands", () => {
  const bands: HomeSectionView = {
    id: "fiyat",
    type: "price_bands",
    title: "Fiyata göre alışveriş",
    bands: [
      {
        label: "₺500 altı",
        text: "Anahtarlık çakılar",
        path: "/magaza?fiyat=-500",
        products: [{ label: "Pars", path: "/urun/pars", image: picture("pars") }],
      },
      { label: "Koleksiyonluk", text: null, path: "/magaza?fiyat=2500-", products: [] },
    ],
  }

  it("links each band to the filtered catalogue, its products small and decorative", () => {
    const html = home([bands])

    expect(html).toContain(">Fiyata göre alışveriş</h2>")
    expect(html).toContain('href="/magaza?fiyat=-500"')
    expect(html).toContain('href="/magaza?fiyat=2500-"')
    expect(html).toContain("Anahtarlık çakılar")
    expect(html).toContain('alt=""')
    expect(html).toContain("lg:grid-cols-2")
    // The band's big figure in the page's ink: the shop's colour stays on actions (K-05)
    expect(html).not.toMatch(/text-display[^"]*text-signal/)
    expect(html).toMatch(/text-display[^"]*text-text/)
    // A price band names no category
    expect(html).not.toContain("font-semibold text-text-2")
  })

  it("links a band with a category to its page without an extra line above the label", () => {
    const html = home([
      {
        ...bands,
        bands: [
          {
            label: "Koleksiyonluk",
            text: "Özel seri",
            category: "Özel Koleksiyon",
            path: "/kategori/ozel-koleksiyon",
            products: [],
          },
          {
            label: "Kamp, ₺1.000'e kadar",
            text: null,
            category: "Kamp",
            path: "/kategori/kamp?fiyat=-1000",
            products: [],
          },
        ],
      },
    ])

    expect(html).toContain('href="/kategori/ozel-koleksiyon"')
    expect(html).toContain('href="/kategori/kamp?fiyat=-1000"')
    // The label is the card's first line: the category's name is not drawn
    // (it pushed that card's label below its neighbours', owner 2026-11-16)
    expect(html).not.toContain("Özel Koleksiyon")
    expect(html).not.toContain(">Kamp<")
    expect(html).toMatch(/<a href="\/kategori\/ozel-koleksiyon"[^>]*><span class="text-display/)
  })

  it("draws a price band and a category band on one skeleton, the products at the card's foot", () => {
    const card = (over: { category?: string; text: string | null; path: string }) => ({
      label: "Band",
      products: [{ label: "Pars", path: "/urun/pars", image: picture("pars") }],
      ...over,
    })
    const html = home([
      {
        ...bands,
        bands: [
          card({ text: "Anahtarlık çakılar", path: "/magaza?fiyat=-500" }),
          card({ text: "Özel seri", category: "Özel Koleksiyon", path: "/kategori/ozel" }),
          card({ text: null, category: "Kamp", path: "/kategori/kamp" }),
        ],
      },
    ])
    const skeletons = cardParts(html)
      // A band without a line has no line: compare the parts every card draws
      .map((parts) => parts.filter((name) => name !== "text-sm text-text-2"))

    expect(skeletons).toHaveLength(3)
    expect(new Set(skeletons.map((parts) => JSON.stringify(parts))).size).toBe(1)
    // Label first, the products last and pushed to the foot whatever the lines above take
    expect(skeletons[0]?.[0]).toMatch(/^text-display /)
    expect(skeletons[0]?.at(-1)).toMatch(/\bmt-auto\b/)
    expect(html).toMatch(/<a href="\/magaza\?fiyat=-500" class="group flex h-full flex-col /)
  })
})

describe("the category cards", () => {
  it("shows each card's count and the shop's own link beside the head", () => {
    const html = home([
      {
        id: "celik",
        type: "categories",
        title: "Çeliğe ve sapa göre",
        categories: [category("Damascus", 3), category("Elmax")],
        more: { label: "Tüm çakılar", path: "/kategori/cakilar" },
      },
    ])

    expect(html).toContain(">3 ürün</span>")
    expect(html.match(/ ürün<\/span>/g)).toHaveLength(1)
    expect(html).toContain('href="/kategori/cakilar"')
    expect(html).not.toContain('href="/kategoriler"')
  })
})
