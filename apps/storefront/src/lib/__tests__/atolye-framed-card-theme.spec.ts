import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  CardShownView,
  FramedCardView,
  ImageView,
  ListingPageView,
  ProductCardView,
} from "@qticaret/ui"
import { t } from "@/lib/i18n"

/**
 * The framed card (UK5 + E5, adr/0049 Ek 2026-11-14 §3.3) as the server
 * prints it: the box, the second photo behind the first (lazy), the free
 * shipping line, empty stars and the button at its foot, each only as the
 * card's `framed` says; a card without it is today's card. The second
 * photo is every variant's (sahip 2026-11-18): the standard card swipes
 * it on a touch screen as the framed one, the compact card only on hover.
 */

const image = (src: string): ImageView => ({
  src,
  alt: "Termos",
  width: 800,
  height: 800,
  sources: { avif: null, webp: null },
})

const FRAMED: FramedCardView = {
  freeShipping: true,
  fullButton: true,
  buttonStyle: "outline",
}

// Empty stars without reviews (adr/0049 Ek 2026-11-15: every card's, no longer the framed card's switch)
const SHOWN: CardShownView = {
  saleBadge: true,
  lowStockBadge: true,
  soldOutBadge: true,
  soldOutRow: "price",
  noReviews: "empty_stars",
}

const card = (over: Partial<ProductCardView> = {}): ProductCardView => ({
  id: "a",
  title: "Çelik Termos",
  path: "/urun/celik-termos",
  brand: null,
  image: image("https://cdn.example/on.jpg"),
  secondImage: image("https://cdn.example/arka.jpg"),
  price: { current: "1.200,00 TL", before: null, from: true, discount: null },
  available: true,
  variant: "framed",
  framed: FRAMED,
  shown: SHOWN,
  ...over,
})

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

const textOf = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

describe("the theme's framed card", () => {
  it("draws the box with both photos, the second lazy and the strip out of the tab order", () => {
    const html = cardOf(card())
    expect(html).toContain("gf-card-framed")
    expect(html.match(/<img /g)).toHaveLength(2)
    expect(html).toMatch(/<img[^>]*src="https:\/\/cdn.example\/arka.jpg"[^>]*loading="lazy"/)
    expect(html).toMatch(/<a href="\/urun\/celik-termos" tabindex="-1" aria-hidden="true"/)
    expect(html).toContain('class="gf-card-dots" aria-hidden="true"')
  })

  it("says free shipping, no reviews yet, and opens its page for its options", () => {
    const text = textOf(cardOf(card()))
    expect(text).toContain(t("product.card_free_shipping"))
    expect(text).toContain(t("product.card_no_reviews"))
    expect(cardOf(card())).toContain(
      `aria-label="${t("product.card_options_label", { title: "Çelik Termos" })}"`
    )
  })

  it("leaves out what the shop switched off, and the button of a product that is out", () => {
    const quiet = cardOf(
      card({
        secondImage: null,
        framed: {
          freeShipping: false,
          fullButton: false,
          buttonStyle: "outline",
        },
        shown: { ...SHOWN, noReviews: "hide" },
      })
    )
    expect(quiet.match(/<img /g)).toHaveLength(1)
    expect(quiet).not.toContain("gf-card-dots")
    const text = textOf(quiet)
    expect(text).not.toContain(t("product.card_free_shipping"))
    expect(text).not.toContain(t("product.card_no_reviews"))
    expect(text).not.toContain(t("product.card_options"))
    const out = textOf(cardOf(card({ available: false })))
    expect(out).not.toContain(t("product.card_options"))
    // Free shipping says nothing on a product that cannot be bought now
    expect(out).not.toContain(t("product.card_free_shipping"))
  })

  it("is today's card without its own fields, or for a variant it does not draw", () => {
    const unframed: ProductCardView = { ...card() }
    delete unframed.framed
    expect(cardOf(unframed)).not.toContain("gf-card-framed")
    expect(cardOf(card({ variant: "technical" as never }))).not.toContain("gf-card-framed")
  })
})

describe("the second photo on every card variant", () => {
  const drawn = (variant: "standard" | "compact") => {
    const view: ProductCardView = { ...card(), variant }
    delete view.framed
    return cardOf(view)
  }

  it("draws the standard card's two photos, the second lazy, the strip out of the tab order", () => {
    const html = drawn("standard")
    expect(html).not.toContain("gf-card-framed")
    expect(html.match(/<img /g)).toHaveLength(2)
    expect(html).toMatch(/<img[^>]*src="https:\/\/cdn.example\/arka.jpg"[^>]*loading="lazy"/)
    expect(html).toMatch(
      /<a href="\/urun\/celik-termos" tabindex="-1" aria-hidden="true" class="gf-card-slides"/
    )
    expect(html).toContain('class="gf-card-dots" aria-hidden="true"')
  })

  it("draws the compact card's two photos for the pointer only: no swipe strip, no dots", () => {
    const html = drawn("compact")
    expect(html.match(/<img /g)).toHaveLength(2)
    expect(html).toContain('class="gf-card-slides gf-card-slides--hover"')
    expect(html).not.toContain("gf-card-dots")
  })

  it("draws one photo for a product with one, on every variant", () => {
    for (const variant of ["standard", "framed", "compact"] as const) {
      const html = cardOf(card({ variant, secondImage: null }))
      expect(html.match(/<img /g)).toHaveLength(1)
      expect(html).not.toContain("gf-card-slides")
    }
  })
})
