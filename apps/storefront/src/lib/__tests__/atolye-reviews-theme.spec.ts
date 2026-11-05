import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ReviewsPageView } from "@qticaret/ui"
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
