import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ReviewFilterView, ReviewsPageView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The Grafit theme's reviews page and 404 (design.md § İçerik sayfaları):
 * the shop's reviews whole with their products beside the shop-wide
 * summary, and a missing page's way on through the search and the
 * category tiles.
 */

const reviews = (over: Partial<ReviewsPageView> = {}): ReviewsPageView => ({
  title: "Müşteri yorumları",
  breadcrumbs: [
    { label: "Ana sayfa", path: "/" },
    { label: "Müşteri yorumları", path: null },
  ],
  average: 4.9,
  count: 28,
  summary: {
    average: "4,9",
    count: 28,
    label: "5 üzerinden 4,9 (28 değerlendirme)",
    distribution: [{ stars: 5, count: 26, percent: 93, label: "5 yıldız: 26 değerlendirme" }],
  },
  reviews: [
    {
      rating: 5,
      title: "Çok iyi",
      body: "Kaliteli ürün.",
      author: "İlker",
      date: "23 Ekim 2026",
      verified: true,
      photos: [],
      product: {
        label: "Geyik Boynuzu Saplı Çakı",
        path: "/urun/geyik",
        image: {
          src: "/media/geyik.jpg",
          alt: "",
          width: 1500,
          height: 1500,
          sources: { avif: null, webp: null },
        },
      },
    },
  ],
  pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: { 1: "/yorumlar" } },
  ...over,
})

describe("the theme's reviews page", () => {
  it("shows the shop-wide summary and each review whole with the product it is about", () => {
    const html = renderPage(atolyeTheme, "ReviewsPage", { view: reviews() })
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain("4,9")
    expect(html).toContain("Kaliteli ürün.")
    expect(html).toContain('href="/urun/geyik"')
    expect(html).toContain('src="/media/geyik.jpg"')
    expect(html).toContain('aria-label="Doğrulanmış alışveriş"')
  })

  it("says so when there is no review yet", () => {
    const html = renderPage(atolyeTheme, "ReviewsPage", {
      view: reviews({ reviews: [], summary: null, average: null, count: 0 }),
    })
    expect(html).toContain("Henüz değerlendirme yok")
  })
})

describe("the theme's star filter (adr/0037 Ek 2026-11-05)", () => {
  const filter = (active: 5 | null): ReviewFilterView => ({
    options: [
      {
        stars: 5,
        count: 26,
        path: "/yorumlar?puan=5",
        label: "Yalnız 5 yıldızlı değerlendirmeler (26)",
        active: active === 5,
      },
      {
        stars: 1,
        count: 0,
        path: null,
        label: "Yalnız 1 yıldızlı değerlendirmeler (0)",
        active: false,
      },
    ],
    active,
    activeLabel: active === null ? null : `${String(active)} yıldız`,
    clearPath: "/yorumlar",
  })
  const summary = {
    average: "4,9",
    count: 28,
    label: "5 üzerinden 4,9 (28 değerlendirme)",
    distribution: [
      { stars: 5 as const, count: 26, percent: 93, label: "5 yıldız: 26 değerlendirme" },
      { stars: 1 as const, count: 0, percent: 0, label: "1 yıldız: 0 değerlendirme" },
    ],
  }

  it("makes each bar a link to its stars alone, out of the index; a number no one gave no link", () => {
    const html = renderPage(atolyeTheme, "ReviewsPage", {
      view: reviews({ summary, filter: filter(null) }),
    })
    expect(html).toContain('href="/yorumlar?puan=5"')
    expect(html).toMatch(/<a href="\/yorumlar\?puan=5" rel="nofollow"/)
    expect(html).toContain("Yalnız 5 yıldızlı değerlendirmeler (26)")
    expect(html).not.toContain("puan=1")
    expect(html).not.toContain('aria-current="true"')
    expect(html).not.toContain("Filtreyi kaldır")
  })

  it("marks the stars shown, with a pill and a link that take the filter off", () => {
    const html = renderPage(atolyeTheme, "ReviewsPage", {
      view: reviews({ summary, filter: filter(5) }),
    })
    expect(html).toMatch(/href="\/yorumlar\?puan=5"[^>]*aria-current="true"/)
    expect(html).toContain('aria-label="Filtreyi kaldır: 5 yıldız"')
    expect(html).toContain("Tüm yorumları göster")
    expect(html).toContain("Kaliteli ürün.")
  })

  it("says so when no review gave those stars, with the way back to all", () => {
    const html = renderPage(atolyeTheme, "ReviewsPage", {
      view: reviews({ summary, filter: filter(5), reviews: [] }),
    })
    expect(html).toContain("Bu puanla verilmiş değerlendirme yok.")
    expect(html).not.toContain("Henüz değerlendirme yok")
    expect(html.match(/href="\/yorumlar"/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it("leaves the home page's summary as it was: no links there", () => {
    const html = renderPage(atolyeTheme, "ReviewsPage", { view: reviews({ summary }) })
    expect(html).not.toContain("puan=")
    expect(html).toContain('aria-label="Puan dağılımı"')
  })
})

describe("the theme's 404", () => {
  it("offers the search as a plain GET, the way home and the shop's categories as picture tiles", () => {
    const html = renderPage(atolyeTheme, "NotFoundPage", {
      view: {
        categories: [
          {
            label: "Çakılar",
            path: "/kategori/cakilar",
            image: {
              src: "/media/c.jpg",
              alt: "",
              width: 800,
              height: 1000,
              sources: { avif: null, webp: null },
            },
          },
        ],
      },
    })
    expect(html).toContain('action="/arama"')
    expect(html).toContain('method="get"')
    expect(html).toContain('name="q"')
    expect(html).toContain('href="/"')
    expect(html).toContain('href="/kategori/cakilar"')
    expect(html).toContain("Kategorilere göz atın")
  })

  it("draws without categories when the storefront gave none", () => {
    const html = renderPage(atolyeTheme, "NotFoundPage", {})
    expect(html).toContain("Sayfa bulunamadı")
    expect(html).not.toContain("Kategorilere göz atın")
  })
})
