import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { CardLookView, ListingPageView, ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { CARD_LOOK_DEFAULTS } from "@/lib/views/card-look"

/**
 * The tour card's look (adr/0077 Ek "tur kartı") as the server prints it:
 * the words over the photo, the stars' pill, the decorative arrow, a dated
 * card's length and "kişi başı". A card without `look` (or with every
 * switch off) prints today's markup; a physical card never gets a dated
 * card's rows.
 */

const card = (over: Partial<ProductCardView> = {}): ProductCardView => ({
  id: "a",
  title: "Kapadokya Balon Turu",
  path: "/urun/kapadokya-balon-turu",
  brand: null,
  image: null,
  price: { current: "1.200,00 TL", before: null, from: false, discount: null },
  available: true,
  ...over,
})

const dated = (over: Partial<ProductCardView> = {}): ProductCardView =>
  card({
    price: { current: "1.750,00 TL", before: null, from: true, discount: null },
    booking: {
      next: "12 Ara",
      nextAt: "2026-12-12T06:00:00.000Z",
      duration: "5 gün • 4 gece",
    },
    ...over,
  })

const rated = { average: "4,8", count: 12, label: "5 üzerinden 4,8 (12 değerlendirme)" }

const look = (over: Partial<CardLookView>): CardLookView => ({ ...CARD_LOOK_DEFAULTS, ...over })

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

const cardOf = (product: ProductCardView) =>
  (renderToStaticMarkup(
    createElement(atolyeTheme.ListingPage, { t, view: listing([product]) })
  ).match(/<article[\s\S]*?<\/article>/g) ?? [])[0] ?? ""

const textOf = (product: ProductCardView) =>
  cardOf(product)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&#x27;/g, "'")

describe("Atölye's card: the tour look", () => {
  it("prints today's card with the look off, a physical and a dated card alike", () => {
    for (const each of [card({ rating: rated }), dated()]) {
      const { booking, ...rest } = each
      const today = booking
        ? { ...rest, booking: { next: booking.next, nextAt: booking.nextAt } }
        : rest
      expect(cardOf({ ...each, look: CARD_LOOK_DEFAULTS })).toBe(cardOf(today))
    }
    expect(cardOf(card())).not.toContain("gf-card-over")
  })

  it("puts the words over the photo on a fade, the price at the right, one link", () => {
    const html = cardOf(card({ look: look({ over: true }) }))
    expect(html).toContain("gf-card-over")
    expect(html).toContain("gf-card-over-text")
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).toContain("1.200,00 TL")
    // The words come before the pills and buttons, which paint over them
    expect(html.indexOf("gf-card-over-text")).toBeLessThan(html.indexOf("<ul"))
  })

  it("keeps the over look to the standard card: the framed and compact keep theirs", () => {
    const framed = card({
      variant: "framed",
      framed: { freeShipping: false, fullButton: false, buttonStyle: "outline" },
      look: look({ over: true }),
    })
    expect(cardOf(framed)).not.toContain("gf-card-over")
    expect(cardOf(card({ variant: "compact", look: look({ over: true }) }))).not.toContain(
      "gf-card-over"
    )
  })

  it("puts the stars as a pill on the photo instead of their row", () => {
    const pill = cardOf(card({ rating: rated, look: look({ ratingBadge: true }) }))
    const row = cardOf(card({ rating: rated }))
    expect(pill).toContain("5 üzerinden 4,8 (12 değerlendirme)")
    expect(pill.match(/4,8/g)).toHaveLength(2)
    expect(pill.indexOf("4,8")).toBeLessThan(pill.indexOf("<h3"))
    expect(pill).not.toContain("(12)")
    expect(row.indexOf("4,8")).toBeGreaterThan(row.indexOf("<h3"))
    expect(row).toContain("(12)")
    // Over the photo there is no stars' row: the pill stands for them
    const over = cardOf(card({ rating: rated, look: look({ over: true }) }))
    expect(over.match(/4,8/g)).toHaveLength(2)
    expect(over).not.toContain("(12)")
    // The compact card keeps its row
    const compact = cardOf(
      card({ variant: "compact", rating: rated, look: look({ ratingBadge: true }) })
    )
    expect(compact).toContain("(12)")
  })

  it("draws the arrow for the eye only, inside the card's one link", () => {
    const html = cardOf(card({ look: look({ arrow: true }) }))
    expect(html).toMatch(/<span aria-hidden="true" class="flex size-9[^"]*rounded-full/)
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).not.toContain("<button")
  })

  it("says a dated card's length and 'kişi başı' when the shop asks, and nothing on a physical card", () => {
    const text = textOf(dated({ look: look({ duration: true, perPerson: true }) }))
    expect(text).toContain("5 gün • 4 gece")
    expect(text).toContain("1.750,00 TL'den itibaren kişi başı")
    expect(text).toContain("En yakın: 12 Ara")
    // Off: neither, though the view has the words
    const off = textOf(dated({ look: look({ arrow: true }) }))
    expect(off).not.toContain("5 gün")
    expect(off).not.toContain("kişi başı")
    // A physical card has no dated rows to draw
    const plain = textOf(card({ look: look({ duration: true, perPerson: true }) }))
    expect(plain).not.toContain("kişi başı")
    expect(plain).not.toContain("gün")
  })

  it("draws a dated card over its photo with its length, next departure and from price", () => {
    const text = textOf(dated({ look: look({ over: true, duration: true, perPerson: true }) }))
    expect(text).toContain("5 gün • 4 gece")
    expect(text).toContain("En yakın: 12 Ara")
    expect(text).toContain("1.750,00 TL'den itibaren kişi başı")
  })
})
