import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { FramedCardView, ImageView, ListingPageView, ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"

/**
 * The framed card (UK5 + E5, adr/0049 Ek 2026-11-14 §3.3) as the server
 * prints it: the box, the second photo behind the first (lazy), the free
 * shipping line, empty stars and the button at its foot, each only as the
 * card's `framed` says; a card without it is today's card.
 */

const image = (src: string): ImageView => ({
  src,
  alt: "Termos",
  width: 800,
  height: 800,
  sources: { avif: null, webp: null },
})

const FRAMED: FramedCardView = {
  secondImage: image("https://cdn.example/arka.jpg"),
  freeShipping: true,
  fullButton: true,
  emptyStars: true,
}

const card = (over: Partial<ProductCardView> = {}): ProductCardView => ({
  id: "a",
  title: "Çelik Termos",
  path: "/urun/celik-termos",
  brand: null,
  image: image("https://cdn.example/on.jpg"),
  price: { current: "1.200,00 TL", before: null, from: true, discount: null },
  available: true,
  variant: "framed",
  framed: FRAMED,
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
        framed: { secondImage: null, freeShipping: false, fullButton: false, emptyStars: false },
      })
    )
    expect(quiet.match(/<img /g)).toHaveLength(1)
    expect(quiet).not.toContain("gf-card-dots")
    const text = textOf(quiet)
    expect(text).not.toContain(t("product.card_free_shipping"))
    expect(text).not.toContain(t("product.card_no_reviews"))
    expect(text).not.toContain(t("product.card_options"))
    expect(textOf(cardOf(card({ available: false })))).not.toContain(t("product.card_options"))
  })

  it("is today's card without its own fields, or for a variant it does not draw", () => {
    const unframed: ProductCardView = { ...card() }
    delete unframed.framed
    expect(cardOf(unframed)).not.toContain("gf-card-framed")
    expect(cardOf(card({ variant: "technical" as never }))).not.toContain("gf-card-framed")
  })
})
