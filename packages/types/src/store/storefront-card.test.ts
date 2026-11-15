import { describe, expect, it } from "vitest"
import {
  CARD_BUTTON_STYLES,
  CARD_NO_REVIEWS,
  CARD_QUICK_VIEW_TRIGGERS,
  CARD_SOLD_OUT_ROWS,
} from "./storefront.js"

/** adr/0049 Ek 2026-11-15: the card's lists; the backend mirrors them (`theme-card.unit.spec.ts`). */
describe("the product card's choices", () => {
  it("names a sold-out card's row, the stars without reviews and the foot button's look", () => {
    expect(CARD_SOLD_OUT_ROWS).toEqual(["price", "text", "notify"])
    expect(CARD_NO_REVIEWS).toEqual(["hide", "empty_stars", "write_first"])
    // The standard's `button_style` names (docs/tema/bilesen-standardi.md §3)
    expect(CARD_BUTTON_STYLES).toEqual(["solid", "outline", "text"])
    // The quick view button: on hover first, today's nothing being the switch off
    expect(CARD_QUICK_VIEW_TRIGGERS).toEqual(["hover", "icon"])
  })
})
