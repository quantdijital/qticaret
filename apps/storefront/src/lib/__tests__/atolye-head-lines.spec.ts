import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  CategoryCardView,
  DeparturesSectionView,
  HeadLinesView,
  HomeSectionView,
  PostCardView,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * A section heading's upper line and hand note (sahip 2026-11-28) on the
 * product rail, the categories, the departures, the reviews and the
 * posts: drawn as the figures strip's (the small upper-case line over the
 * heading, the tilted note with its brush stroke after it), each only once
 * the shop wrote it; without them every head is the one it was.
 */

const draw = (section: HomeSectionView) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections: [section] } })

const NOTE = { text: "Yol seni çağırır", hand: true }

const card = (at: number): CategoryCardView => ({
  label: `Kategori ${String(at)}`,
  path: `/kategori/k${String(at)}`,
  image: null,
})

const post: PostCardView = {
  title: "Gizli koylar",
  path: "/blog/koylar",
  excerpt: "Kısa",
  image: null,
  date: "1 Kasım 2026",
  dateTime: "2026-11-01T09:00:00.000Z",
  reading: "5 dk okuma",
  category: null,
}

const departures = (lines: HeadLinesView = {}): HomeSectionView => {
  const view: DeparturesSectionView = {
    id: "kalkislar",
    type: "departures",
    title: "Yakında yola çıkıyoruz",
    intro: null,
    rows: [],
    open: "İncele",
    layout: "list",
    phone: "stack",
    ...lines,
  }
  return view
}

const SECTIONS: [string, (lines?: HeadLinesView) => HomeSectionView][] = [
  [
    "the categories",
    (lines = {}) => ({
      id: "kategoriler",
      type: "categories",
      title: "Popüler kategoriler",
      categories: [card(1), card(2)],
      ...lines,
    }),
  ],
  [
    "the reviews",
    (lines = {}) => ({
      id: "yorumlar",
      type: "reviews",
      title: "Misafir yorumları",
      reviews: [],
      // The shop-wide summary alone draws the section
      summary: {
        average: "4,8",
        count: 12,
        label: "5 üzerinden 4,8 (12 değerlendirme)",
        distribution: [],
      },
      more: { label: "Tüm yorumlar", path: "/yorumlar" },
      ...lines,
    }),
  ],
  [
    "the posts",
    (lines = {}) => ({
      id: "yazilar",
      type: "posts",
      title: "Yol notları",
      posts: [post],
      more: { label: "Tüm yazılar", path: "/blog" },
      ...lines,
    }),
  ],
  [
    "the product rail",
    (lines = {}) => ({
      id: "populer",
      type: "products",
      title: "Bu sezon",
      products: [],
      more: null,
      empty: "Henüz ürün yok",
      ...lines,
    }),
  ],
  ["the departures", departures],
]

describe("a section heading's upper line and hand note", () => {
  it.each(SECTIONS)("draws %s's lines once written", (_, section) => {
    const html = draw(section({ eyebrow: "Popüler rotalar", note: NOTE }))
    expect(html).toContain(
      '<p class="text-xs font-semibold tracking-[0.18em] text-text-2 uppercase">Popüler rotalar</p>'
    )
    expect(html).toContain("Yol seni çağırır</p>")
    expect(html).toContain("data-hand")
    // The brush stroke under the note, for the eye only
    expect(html).toContain('aria-hidden="true" viewBox="0 0 120 14"')
    // The upper line stands before the heading
    expect(html.indexOf("Popüler rotalar")).toBeLessThan(html.indexOf("<h2"))
  })

  it.each(SECTIONS)("keeps %s's head as it was without them", (_, section) => {
    const html = draw(section())
    expect(html).not.toContain("tracking-[0.18em]")
    expect(html).not.toContain('viewBox="0 0 120 14"')
    expect(html).not.toContain("data-hand")
    expect(draw(section({ eyebrow: null }))).toBe(html)
  })

  it("draws the one line written, alone", () => {
    const eyebrowOnly = draw(departures({ eyebrow: "Kalkış takvimi" }))
    expect(eyebrowOnly).toContain(">Kalkış takvimi</p>")
    expect(eyebrowOnly).not.toContain('viewBox="0 0 120 14"')
    const noteOnly = draw(departures({ note: { text: "Yerinizi ayırın", hand: false } }))
    expect(noteOnly).not.toContain("tracking-[0.18em]")
    // With no accent face the note stands in the theme's own face, italic
    expect(noteOnly).toMatch(/class="[^"]*italic[^"]*">Yerinizi ayırın<\/p>/)
  })
})
