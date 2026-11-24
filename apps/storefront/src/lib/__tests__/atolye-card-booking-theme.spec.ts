import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ListingPageView, ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"

/**
 * A dated product's card (adr/0076 §10) as the server prints it: "…'den
 * itibaren" and the nearest departure, or "new dates soon"; a card
 * without `booking` is printed as it was.
 */

const card = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image: null,
  price: { current: "1.750,50 TL", before: null, from: true, discount: null },
  available: true,
  ...over,
})

const listing = (products: ProductCardView[]): ListingPageView => ({
  title: "Turlar",
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

const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")

describe("the theme's dated product card", () => {
  it("says the from price and the nearest departure", () => {
    const [html = ""] = cardsOf([
      card("a", { booking: { next: "12 Ara", nextAt: "2026-12-12T06:00:00.000Z" } }),
    ])
    expect(textOf(html)).toContain("1.750,50 TL'den itibaren")
    expect(textOf(html)).toContain("En yakın: 12 Ara")
    expect(html).toContain('<time dateTime="2026-12-12T06:00:00.000Z">')
    expect(textOf(html)).not.toContain("başlayan")
  })

  it("says new dates soon without a departure, the from price still", () => {
    const [html = ""] = cardsOf([card("a", { booking: { next: null, nextAt: null } })])
    expect(textOf(html)).toContain("1.750,50 TL'den itibaren")
    expect(textOf(html)).toContain("Yakında yeni tarihler")
    expect(html).not.toContain("<time")
  })

  it("keeps the amount whole and lets only the words after it break on a narrow card", () => {
    const [html = ""] = cardsOf([card("a", { booking: { next: null, nextAt: null } })])
    expect(html).toMatch(/<span class="[^"]*whitespace-nowrap[^"]*">1\.750,50 TL&#x27;den<\/span>/)
    expect(html).toMatch(/<span class="[^"]*@max-\[13rem\]:text-xs[^"]*">itibaren<\/span>/)
  })

  it("draws a card without booking as before", () => {
    const [plain = ""] = cardsOf([card("a")])
    const [dated = ""] = cardsOf([card("a", { booking: { next: null, nextAt: null } })])
    expect(textOf(plain)).toContain("1.750,50 TL'den başlayan")
    expect(textOf(plain)).not.toContain("itibaren")
    expect(plain).not.toBe(dated)
  })

  it("strikes the price before an automatic promotion through only when the card has one", () => {
    const booking = { next: null, nextAt: null }
    const [promoted = ""] = cardsOf([
      card("a", {
        booking,
        price: { current: "1.400,40 TL", before: "1.750,50 TL", from: true, discount: 20 },
      }),
    ])
    const [plain = ""] = cardsOf([card("a", { booking })])
    expect(textOf(promoted)).toContain("1.400,40 TL'den itibaren")
    expect(promoted).toMatch(/<s class="[^"]*">[\s\S]*1\.750,50 TL<\/s>/)
    expect(plain).not.toContain("</s>")
  })
})
