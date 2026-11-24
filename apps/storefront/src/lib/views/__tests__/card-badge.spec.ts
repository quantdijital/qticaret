import { describe, expect, it } from "vitest"
import type { ProductCardView } from "@qticaret/ui"
import type { StoreCardFacts } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { cardBadge } from "../card-badge"
import { withCardFacts } from "../card-extras"

const card = (id: string): ProductCardView => ({
  id,
  title: id,
  path: `/urun/${id}`,
  brand: null,
  image: null,
  price: { current: "100,00 TL", before: null, from: false, discount: null },
  available: true,
})

const fact = (over: Partial<StoreCardFacts> = {}): StoreCardFacts => ({
  stock: "in_stock",
  quick_add: null,
  rating: null,
  ...over,
})

describe("the card's badge (the owner, 2026-11-24)", () => {
  it("says the shop's own line as written, the others in the storefront's words", () => {
    expect(cardBadge({ kind: "manual", text: " Sınırlı " }, t)).toEqual({
      text: "Sınırlı",
      kind: "manual",
    })
    expect(cardBadge({ kind: "best_seller" }, t)).toEqual({
      text: "Çok satan",
      kind: "best_seller",
    })
    expect(cardBadge({ kind: "new" }, t)).toEqual({ text: "Yeni", kind: "new" })
  })

  it("has none without one, an empty line or a kind it does not know", () => {
    expect(cardBadge(undefined, t)).toBeNull()
    expect(cardBadge({ kind: "manual", text: "  " }, t)).toBeNull()
    expect(cardBadge({ kind: "other" } as unknown as StoreCardFacts["badge"], t)).toBeNull()
  })

  it("puts the field on a card only with a badge: any other card as it was", () => {
    const facts = { a: fact({ badge: { kind: "new" } }), b: fact() }
    const [badged, plain] = withCardFacts([card("a"), card("b")], facts, { showRating: true }, t)
    expect(badged?.badge).toEqual({ text: "Yeni", kind: "new" })
    expect(plain && "badge" in plain).toBe(false)
  })
})
