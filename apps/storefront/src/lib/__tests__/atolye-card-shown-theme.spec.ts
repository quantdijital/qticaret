import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { CardShownView, ListingPageView, ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"

/**
 * The owner's four card decisions (adr/0049 Ek 2026-11-15) as the server
 * prints them, on the standard, framed and compact cards: each pill on or
 * off, a sold-out card's price row, the stars' place without reviews and
 * the framed card's foot button. A card without `shown` is today's.
 */

const TODAY: CardShownView = {
  saleBadge: true,
  lowStockBadge: true,
  soldOutBadge: true,
  soldOutRow: "price",
  noReviews: "hide",
}

const card = (over: Partial<ProductCardView> = {}): ProductCardView => ({
  id: "a",
  title: "Çelik Termos",
  path: "/urun/celik-termos",
  brand: null,
  image: null,
  price: { current: "1.200,00 TL", before: "1.500,00 TL", from: false, discount: 20 },
  available: true,
  ...over,
})

const shown = (over: Partial<CardShownView>): CardShownView => ({ ...TODAY, ...over })

const listing = (products: ProductCardView[]): ListingPageView => ({
  title: "Termoslar",
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

const FRAMED = {
  variant: "framed" as const,
  framed: {
    freeShipping: false,
    fullButton: true,
    buttonStyle: "outline" as const,
  },
}
const VARIANTS: Partial<ProductCardView>[] = [{}, FRAMED, { variant: "compact" }]
const SALE = t("product.discount", { percent: 20 })
const OUT = t("product.out_of_stock")
const LOW = t("product.few_left")

describe("the theme's card pills (decision a)", () => {
  it("draws each pill unless the shop turns it off, on every variant", () => {
    for (const variant of VARIANTS) {
      expect(textOf(card(variant))).toContain(SALE)
      expect(textOf(card({ ...variant, shown: shown({ saleBadge: false }) }))).not.toContain(SALE)
      const out = { ...variant, available: false }
      expect(textOf(card(out))).toContain(OUT)
      expect(textOf(card({ ...out, shown: shown({ soldOutBadge: false }) }))).not.toContain(OUT)
    }
  })

  it("draws 'Az kaldı' on a low stock bucket unless turned off; the compact card never did", () => {
    const low = { stock: "low" as const }
    expect(textOf(card(low))).toContain(LOW)
    expect(textOf(card({ ...low, shown: shown({ lowStockBadge: false }) }))).not.toContain(LOW)
    expect(textOf(card({ ...low, variant: "compact" }))).not.toContain(LOW)
  })

  it("shows a sold-out compact card's discount once its 'Tükendi' pill is off", () => {
    const out = card({
      variant: "compact",
      available: false,
      shown: shown({ soldOutBadge: false }),
    })
    expect(textOf(out)).toContain(SALE)
  })
})

describe("a sold-out card's price row (decision b)", () => {
  it("keeps the price with nothing to add by default, as today", () => {
    for (const variant of VARIANTS) {
      const text = textOf(card({ ...variant, available: false }))
      expect(text).toContain("1.200,00 TL")
      expect(text).not.toContain(t("product.card_options"))
    }
  })

  it("writes 'Tükendi' in the price's place, or links to the page's stock alert form", () => {
    for (const variant of VARIANTS) {
      const out = { ...variant, available: false, shown: shown({ soldOutBadge: false }) }
      const text = textOf(
        card({ ...out, shown: shown({ soldOutBadge: false, soldOutRow: "text" }) })
      )
      expect(text).toContain(OUT)
      expect(text).not.toContain("1.200,00 TL")
      const notify = cardOf(card({ ...out, shown: shown({ soldOutRow: "notify" }) }))
      expect(notify).toContain('href="/urun/celik-termos#stok-bildirimi"')
      expect(notify).toContain(t("product.card_notify"))
      expect(notify).not.toContain("1.200,00 TL")
    }
  })

  it("leaves a card that can be bought alone", () => {
    const text = textOf(card({ shown: shown({ soldOutRow: "notify" }) }))
    expect(text).toContain("1.200,00 TL")
    expect(text).not.toContain(t("product.card_notify"))
  })
})

describe("the stars' place without reviews (decision c)", () => {
  it("draws nothing, empty stars, or a link to write the first review, on every variant", () => {
    for (const variant of VARIANTS) {
      expect(textOf(card(variant))).not.toContain(t("product.card_no_reviews"))
      expect(textOf(card({ ...variant, shown: shown({ noReviews: "empty_stars" }) }))).toContain(
        t("product.card_no_reviews")
      )
      const first = cardOf(card({ ...variant, shown: shown({ noReviews: "write_first" }) }))
      expect(first).toContain('href="/urun/celik-termos#degerlendirmeler"')
      expect(first).toContain(t("product.card_write_first"))
    }
  })

  it("draws a reviewed product's own stars whatever the choice", () => {
    const rated = card({
      rating: { average: "4,5", count: 12, label: "5 üzerinden 4,5 (12 değerlendirme)" },
      shown: shown({ noReviews: "write_first" }),
    })
    expect(textOf(rated)).toContain("4,5")
    expect(textOf(rated)).not.toContain(t("product.card_write_first"))
  })
})

describe("the framed card's foot button (decision d)", () => {
  const foot = (buttonStyle: "solid" | "outline" | "text") =>
    cardOf(card({ ...FRAMED, framed: { ...FRAMED.framed, buttonStyle } }))
  it("is the quiet bordered button by default, filled or a word as the shop chooses", () => {
    expect(foot("outline")).toContain("gf-btn gf-btn--quiet gf-card-btn relative")
    expect(foot("solid")).toContain("gf-card-btn--solid")
    expect(foot("solid")).not.toContain("gf-btn--quiet")
    expect(foot("text")).toContain("gf-card-btn--text")
  })
})
