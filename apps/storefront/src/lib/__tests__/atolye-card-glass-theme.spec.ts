import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { CardLookView, ListingPageView, ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { CARD_LOOK_DEFAULTS } from "@/lib/views/card-look"

/**
 * The card's details on its photo (`meta_place: over`) and the glass card
 * (`style: glass`, sahip 2026-11-26) as the server prints them: the stars,
 * length and departure as frosted pills on the photo, only the name and
 * price under it; the glass card's floating panel with "İncele". Without
 * them, today's card.
 */

const rated = { average: "4,8", count: 12, label: "5 üzerinden 4,8 (12 değerlendirme)" }

const look = (over: Partial<CardLookView>): CardLookView => ({ ...CARD_LOOK_DEFAULTS, ...over })

const card = (over: Partial<ProductCardView> = {}): ProductCardView => ({
  id: "a",
  title: "Kapadokya Balon Turu",
  path: "/urun/kapadokya-balon-turu",
  brand: null,
  image: null,
  price: { current: "1.750,00 TL", before: null, from: true, discount: null },
  available: true,
  rating: rated,
  booking: { next: "12 Ara", nextAt: "2026-12-12T06:00:00.000Z", duration: "5 gün • 4 gece" },
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

const cardOf = (product: ProductCardView) =>
  (renderToStaticMarkup(
    createElement(atolyeTheme.ListingPage, { t, view: listing([product]) })
  ).match(/<article[\s\S]*?<\/article>/g) ?? [])[0] ?? ""

/** The card's markup after its photo's well: the words under it. */
const wordsOf = (markup: string) => markup.slice(markup.lastIndexOf("</ul>"))

describe("Atölye's card: the details on the photo", () => {
  it("prints today's card without them", () => {
    const today = look({ compact: true, duration: true })
    expect(cardOf(card({ look: { ...today, metaOver: false, glass: false } }))).toBe(
      cardOf(card({ look: today }))
    )
    expect(cardOf(card({ look: today }))).not.toContain("gf-card-glass")
  })

  it("puts the stars, length and departure in frosted pills, the name and price under the photo", () => {
    for (const compact of [false, true]) {
      const markup = cardOf(card({ look: look({ compact, duration: true, metaOver: true }) }))
      const pills = markup.match(/gf-card-glass-pill/g) ?? []
      expect(pills).toHaveLength(3)
      expect(markup).toContain("4,8")
      expect(markup).toContain(rated.label)
      // Each once: on the photo, not in the rows
      expect(markup.split("5 gün • 4 gece")).toHaveLength(2)
      expect(markup.split("12 Ara")).toHaveLength(2)
      expect(markup).toContain("Kapadokya Balon Turu")
      expect(markup).toContain("1.750,00 TL")
    }
  })

  it("draws no pill for what the product lacks", () => {
    const bare = card({ rating: null, look: look({ metaOver: true }) })
    delete bare.booking
    const markup = cardOf(bare)
    expect(markup).not.toContain("gf-card-glass-pill")
    expect(wordsOf(markup)).toContain("1.750,00 TL")
  })
})

describe("Atölye's card: the glass panel", () => {
  it("floats the name and price on a frosted panel with İncele, the details on the photo", () => {
    const markup = cardOf(card({ look: look({ glass: true, metaOver: true, duration: true }) }))
    expect(markup).toContain("gf-card-glass ")
    expect(markup).toContain("gf-card-glass-panel")
    expect(markup).toContain("İncele")
    expect(markup.match(/gf-card-glass-pill/g)).toHaveLength(3)
    // One link, the name's
    expect(markup.match(/<a /g)).toHaveLength(1)
  })

  it("keeps the details in the panel while they are not on the photo", () => {
    const markup = cardOf(card({ look: look({ glass: true, duration: true }) }))
    expect(markup).not.toContain("gf-card-glass-pill")
    expect(markup).toContain("5 gün • 4 gece")
    expect(markup).toContain("12 Ara")
    expect(markup).toContain("(12)")
  })

  it("keeps the stars in the panel when the shop asked for the stars' pill", () => {
    const markup = cardOf(card({ look: look({ glass: true, ratingBadge: true }) }))
    expect(markup.split("(12)")).toHaveLength(2)
    expect(markup).not.toContain("bg-field px-2 py-1 text-text")
  })
})

describe("Atölye's card: the badges beside the details on the photo", () => {
  it("puts the badge and the stars in one wrapping row, the stars at its end", () => {
    for (const glass of [false, true]) {
      const markup = cardOf(
        card({
          badge: { kind: "best_seller", text: "Çok satan" },
          price: { current: "1.750,00 TL", before: "2.500,00 TL", from: true, discount: 30 },
          look: look({ metaOver: true, glass }),
        })
      )
      const row = /<div class="[^"]*justify-between[^"]*">[\s\S]*?<\/div>/.exec(markup)
      expect(row?.[0]).toContain("Çok satan")
      expect(row?.[0]).toContain("4,8")
      expect(row?.[0]).toContain("ms-auto")
    }
  })
})
