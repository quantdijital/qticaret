import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ListingPageView, ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"

/**
 * The card's stars (adr/0062) as the server prints them: drawn only for a
 * card that carries a rating, the average and count for the eye, one
 * sentence for a screen reader; a card without one has no such row.
 */

const card = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image: null,
  price: { current: "100,00 TL", before: null, from: false, discount: null },
  available: true,
  ...over,
})

const LABEL = "5 üzerinden 4,3 (12 değerlendirme)"

const listing = (products: ProductCardView[]): ListingPageView => ({
  title: "Bıçaklar",
  description: [],
  breadcrumbs: [],
  subcategories: [],
  products,
  total: products.length,
  pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: {} },
  sort: [],
  filters: [],
  price: null,
  active: [],
  clearPath: null,
})

const cardsOf = (products: ProductCardView[]) =>
  renderToStaticMarkup(
    createElement(atolyeTheme.ListingPage, { t, view: listing(products) })
  ).match(/<article[\s\S]*?<\/article>/g) ?? []

describe("the theme's card rating", () => {
  it("draws the stars, the average and the count, and says them once in words", () => {
    const [rated] = cardsOf([card("a", { rating: { average: "4,3", count: 12, label: LABEL } })])
    expect(rated).toBeDefined()
    const html = rated ?? ""
    // Five stars for the eye only, four of them filled (4,3 to the nearest whole star)
    expect(html.match(/<svg[^>]*fill-star/g)).toHaveLength(4)
    expect(html.match(/<svg[^>]*fill-paper-3/g)).toHaveLength(1)
    const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ")
    expect(text).toContain("4,3 (12)")
    // The sentence is the only part a screen reader hears
    expect(html).toContain(`<span class="sr-only">${LABEL}</span>`)
    expect(html.split(LABEL)).toHaveLength(2)
    // The stars and the short figures are hidden from it
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>\s*<svg/)
    expect(html).toMatch(/<span aria-hidden="true"[^>]*><span[^>]*>4,3<\/span>/)
  })

  it("draws no rating row on a card without one", () => {
    const [bare, cleared] = cardsOf([card("a"), card("b", { rating: null })])
    for (const html of [bare ?? "", cleared ?? ""]) {
      expect(html).not.toBe("")
      expect(html).not.toContain("fill-star")
      expect(html).not.toContain("değerlendirme")
      // The title and the price are still there
      expect(html).toContain("100,00 TL")
    }
  })
})
