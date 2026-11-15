import { describe, expect, it } from "vitest"
import type { ProductCardView } from "@qticaret/ui"
import type { StoreProduct } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { withCardFacts } from "../card-extras"
import { railCardVariant } from "../card-framed"
import { productCard } from "../product"
import type { CardOptions } from "../product"

const variant = (id: string, amount: number) => ({
  id,
  title: id,
  sku: null,
  manage_inventory: false,
  allow_backorder: false,
  inventory_quantity: null,
  options: [],
  calculated_price: { calculated_amount: amount, original_amount: amount, currency_code: "try" },
})

const product = (over: Partial<StoreProduct> = {}): StoreProduct => ({
  id: "prod_1",
  title: "Çelik Termos",
  handle: "celik-termos",
  subtitle: null,
  description: null,
  thumbnail: null,
  images: [
    { id: "img_2", url: "https://cdn.example/arka.jpg", rank: 1 },
    { id: "img_1", url: "https://cdn.example/on.jpg", rank: 0 },
  ],
  variants: [variant("variant_a", 1200), variant("variant_b", 1500)],
  ...over,
})

const SWITCHES: NonNullable<CardOptions["framed"]> = {
  hoverImage: true,
  deliveryNote: true,
  fullButton: true,
  buttonStyle: "solid",
  freeShippingFrom: 1000,
}

const FRAMED: CardOptions = {
  showBrand: true,
  showRating: true,
  variant: "framed",
  framed: SWITCHES,
  // adr/0049 Ek 2026-11-15: empty stars without reviews, every card's choice now
  shown: {
    saleBadge: true,
    lowStockBadge: true,
    soldOutBadge: true,
    soldOutRow: "price",
    noReviews: "empty_stars",
  },
}

const card = (over: Partial<StoreProduct> = {}, options: CardOptions = FRAMED) =>
  productCard(product(over), "/urun/celik-termos", {}, options)

describe("a framed card (adr/0049 Ek 2026-11-14 §3.3)", () => {
  it("is today's card, its view unchanged, unless the shop or the rail frames it", () => {
    const standard = card({}, { showBrand: true, showRating: false })
    expect(standard).not.toHaveProperty("variant")
    expect(standard).not.toHaveProperty("framed")
    expect(card({}, { ...FRAMED, variant: "standard" })).not.toHaveProperty("framed")
  })

  it("carries the second photo by rank, the free shipping line and the shop's switches", () => {
    const framed = card()
    expect(framed.image?.src).toBe("https://cdn.example/on.jpg")
    expect(framed).toMatchObject({
      variant: "framed",
      framed: {
        secondImage: { src: "https://cdn.example/arka.jpg" },
        freeShipping: true,
        fullButton: true,
        buttonStyle: "solid",
      },
      shown: { noReviews: "empty_stars" },
    })
  })

  it("has no second photo with one photo or with the switch off", () => {
    expect(
      card({ images: [{ id: "img_1", url: "https://cdn.example/on.jpg" }] }).framed
    ).toMatchObject({ secondImage: null })
    const off = { ...FRAMED, framed: { ...SWITCHES, hoverImage: false } }
    expect(card({}, off).framed?.secondImage).toBeNull()
  })

  it("says free shipping only when every price reaches the threshold, for a shipped product", () => {
    expect(
      card({ variants: [variant("variant_a", 999), variant("variant_b", 1500)] }).framed
    ).toMatchObject({ freeShipping: false })
    expect(
      card({ product_extension: { kind: "digital", is_gift_card: false } }).framed?.freeShipping
    ).toBe(false)
    expect(card({ product_extension: { is_gift_card: true } }).framed?.freeShipping).toBe(false)
    const none = { ...FRAMED, framed: { ...SWITCHES, freeShippingFrom: null } }
    expect(card({}, none).framed?.freeShipping).toBe(false)
    const quiet = { ...FRAMED, framed: { ...SWITCHES, deliveryNote: false } }
    expect(card({}, quiet).framed?.freeShipping).toBe(false)
  })

  it("keeps its empty stars only when the facts say there is no review", () => {
    const framed = card()
    const facts = (rating: { average: number; count: number } | null | undefined) => ({
      prod_1: {
        stock: "in_stock" as const,
        quick_add: null,
        ...(rating === undefined ? {} : { rating }),
      },
    })
    const empty = (cards: ProductCardView[]) => cards[0]?.shown?.noReviews === "empty_stars"
    expect(empty(withCardFacts([framed], facts(null), FRAMED, t))).toBe(true)
    // An older backend says nothing of reviews; no facts at all neither: today's card again
    expect(empty(withCardFacts([framed], facts(undefined), FRAMED, t))).toBe(false)
    expect(withCardFacts([framed], {}, FRAMED, t)[0]).not.toHaveProperty("shown")
    const [rated] = withCardFacts([framed], facts({ average: 4.5, count: 2 }), FRAMED, t)
    expect(rated?.rating?.count).toBe(2)
  })
})

describe("a rail's own card variant (owner's decision 4)", () => {
  it("is the rail's when on the list, else the theme setting's (null)", () => {
    expect(railCardVariant({ card_variant: "framed" })).toBe("framed")
    expect(railCardVariant({ card_variant: "standard" })).toBe("standard")
    expect(railCardVariant({ card_variant: null })).toBeNull()
    expect(railCardVariant({})).toBeNull()
    expect(railCardVariant({ card_variant: "technical" as never })).toBeNull()
  })
})
