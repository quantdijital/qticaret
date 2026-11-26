import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { CardLookView, ImageView, ListingPageView, ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { CARD_LOOK_DEFAULTS } from "@/lib/views/card-look"

/**
 * The compact tour card and its photos in turn (sahip 2026-11-26) as the
 * server prints them: the price right under the name, the stars with
 * their count and the length on one line; over the photo, those in the
 * pill; the photos after the second out of the layout until their turn.
 * Without them, today's card.
 */

const photo = (name: string): ImageView => ({
  src: `https://cdn.example/${name}.jpg`,
  alt: name,
  width: 800,
  height: 600,
  sources: { avif: null, webp: null },
})

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

const textOf = (product: ProductCardView) =>
  cardOf(product)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&#x27;/g, "'")

describe("Atölye's card: the compact rows", () => {
  it("prints today's card while the look is not compact", () => {
    const today = look({ duration: true })
    expect(cardOf(card({ look: { ...today, compact: false } }))).toBe(cardOf(card({ look: today })))
    expect(cardOf(card({ look: today }))).toContain("gap-3")
  })

  it("puts the price right under the name, then the stars, their count and the length", () => {
    const text = textOf(card({ look: look({ compact: true, duration: true }) }))
    const name = text.indexOf("Kapadokya Balon Turu")
    const price = text.indexOf("1.750,00 TL")
    const stars = text.indexOf("4,8 (12)")
    const length = text.indexOf("5 gün • 4 gece")
    expect(name).toBeGreaterThanOrEqual(0)
    expect(price).toBeGreaterThan(name)
    expect(stars).toBeGreaterThan(price)
    expect(length).toBeGreaterThan(stars)
    // The rating's whole sentence for a screen reader, the length once
    expect(text).toContain(rated.label)
    expect(text.split("5 gün • 4 gece")).toHaveLength(2)
    expect(cardOf(card({ look: look({ compact: true }) }))).not.toContain("mt-auto")
  })

  it("carries the count and the length in the pill when the words stand over the photo", () => {
    const over = card({ look: look({ compact: true, over: true, split: true, duration: true }) })
    const pill = (/<ul[\s\S]*?<\/ul>/.exec(cardOf(over)) ?? [])[0] ?? ""
    expect(pill).toContain("gf-card-pill-dark")
    expect(pill).toContain("(12)")
    expect(pill).toContain("5 gün • 4 gece")
  })
})

describe("Atölye's card: the photos in turn", () => {
  const two = { image: photo("1"), secondImage: photo("2") }

  it("prints the photos after the second, marked for the script, none without them", () => {
    const markup = cardOf(card({ ...two, morePhotos: [photo("3"), photo("4")] }))
    expect(markup).toContain("data-cycle")
    expect(markup.match(/gf-card-slide--more/g)).toHaveLength(2)
    expect(markup).toContain("https://cdn.example/4.jpg")
    // Lazily, never with the first paint
    expect(markup.match(/loading="lazy"/g)?.length).toBeGreaterThanOrEqual(3)
    expect(cardOf(card(two))).not.toContain("data-cycle")
    expect(cardOf(card(two))).not.toContain("gf-card-slide--more")
  })
})
