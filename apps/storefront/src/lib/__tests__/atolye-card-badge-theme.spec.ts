import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ListingPageView, ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { CARD_LOOK_DEFAULTS } from "@/lib/views/card-look"

/**
 * The product badge on Atölye's card (the owner, 2026-11-24): one small
 * pill at the photo's top left, before the stars' pill so the two never
 * cover each other. A card without one prints today's markup.
 */

const card = (over: Partial<ProductCardView> = {}): ProductCardView => ({
  id: "a",
  title: "Şef bıçağı",
  path: "/urun/sef-bicagi",
  brand: null,
  image: null,
  price: { current: "1.200,00 TL", before: null, from: false, discount: 20 },
  available: true,
  ...over,
})

const rated = { average: "4,8", count: 12, label: "5 üzerinden 4,8 (12 değerlendirme)" }

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

const cardOf = (product: ProductCardView) =>
  (renderToStaticMarkup(
    createElement(atolyeTheme.ListingPage, { t, view: listing([product]) })
  ).match(/<article[\s\S]*?<\/article>/g) ?? [])[0] ?? ""

describe("Atölye's card: the product badge", () => {
  it("prints today's card without a badge, null or absent alike", () => {
    expect(cardOf(card({ badge: null }))).toBe(cardOf(card()))
    expect(cardOf(card())).not.toContain("data-badge")
  })

  it("puts the badge first among the photo's pills, the stars' pill after it", () => {
    const html = cardOf(
      card({
        badge: { text: "Sınırlı", kind: "manual" },
        rating: rated,
        look: { ...CARD_LOOK_DEFAULTS, ratingBadge: true },
      })
    )
    const pills = /<ul class="absolute top-2 left-2[\s\S]*?<\/ul>/.exec(html)?.[0] ?? ""
    expect(pills).toContain('data-badge="manual"')
    expect(pills).toContain(">Sınırlı</li>")
    expect(pills.indexOf("data-badge")).toBeLessThan(pills.indexOf("4,8"))
    // The discount pill stays
    expect(pills).toContain("%20")
  })

  it("says each kind with its own words", () => {
    const html = cardOf(card({ badge: { text: "Çok satan", kind: "best_seller" } }))
    expect(html).toContain('data-badge="best_seller"')
    expect(html).toContain("Çok satan")
  })
})
