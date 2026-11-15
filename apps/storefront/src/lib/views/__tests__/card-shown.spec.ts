import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { CARD_SHOWN_DEFAULTS, cardShown, unrated } from "../card-shown"
import { withCardFacts } from "../card-extras"
import { productCard } from "../product"

const product = {
  id: "prod_1",
  title: "Çelik Termos",
  handle: "celik-termos",
  variants: [],
  images: [],
} as unknown as StoreProduct

/** adr/0049 Ek 2026-11-15: what every card shows, from the theme setting. */
describe("a card's shown pills and rows", () => {
  it("leaves today's card as it was: no `shown` without a change", () => {
    expect(cardShown(undefined)).toBeUndefined()
    expect(cardShown(CARD_SHOWN_DEFAULTS)).toBeUndefined()
    const card = productCard(
      product,
      "/urun/celik-termos",
      {},
      {
        showBrand: true,
        showRating: false,
        shown: CARD_SHOWN_DEFAULTS,
      }
    )
    expect(card).not.toHaveProperty("shown")
  })

  it("carries the shop's change on every variant", () => {
    const shown = { ...CARD_SHOWN_DEFAULTS, saleBadge: false, soldOutRow: "notify" as const }
    for (const variant of ["standard", "framed", "compact"] as const) {
      const card = productCard(
        product,
        "/urun/celik-termos",
        {},
        {
          showBrand: true,
          showRating: false,
          variant,
          shown,
        }
      )
      expect(card.shown).toEqual(shown)
    }
  })

  it("draws no empty stars or first-review link where the reviews are unknown", () => {
    const shown = { ...CARD_SHOWN_DEFAULTS, noReviews: "write_first" as const }
    const card = productCard(product, "/u", {}, { showBrand: true, showRating: true, shown })
    expect(unrated(card)).not.toHaveProperty("shown")
    const both = { ...card, shown: { ...shown, saleBadge: false } }
    expect(unrated(both).shown).toEqual({ ...shown, saleBadge: false, noReviews: "hide" })
    // The facts say there is none: the choice stands
    const facts = { prod_1: { stock: "in_stock" as const, quick_add: null, rating: null } }
    expect(withCardFacts([card], facts, { showRating: true }, t)[0]?.shown?.noReviews).toBe(
      "write_first"
    )
  })
})
