import { describe, expect, it } from "vitest"
import { giftLineOf, orderGiftCards, soldAsGiftCard } from "./gift-lines"

describe("giftLineOf", () => {
  it("reads the recipient and the issued cards a gift line records", () => {
    expect(
      giftLineOf({
        qt_gift: {
          recipient_email: "ayse@example.com",
          recipient_name: " Ayşe ",
          message: "İyi ki",
        },
        qt_gift_cards: [
          { id: "gcard_1", last4: "1234" },
          { id: "gcard_2", last4: "5678" },
        ],
      })
    ).toEqual({
      recipient: { email: "ayse@example.com", name: "Ayşe" },
      cards: [
        { id: "gcard_1", last4: "1234" },
        { id: "gcard_2", last4: "5678" },
      ],
    })
  })

  it("keeps the cards once an erasure request took the recipient, and skips broken entries", () => {
    expect(
      giftLineOf({ qt_gift_cards: [{ id: "gcard_1", last4: "1234" }, { id: 7 }, null, "x"] })
    ).toEqual({ recipient: null, cards: [{ id: "gcard_1", last4: "1234" }] })
  })

  it("is null for any other line", () => {
    expect(giftLineOf(null)).toBeNull()
    expect(giftLineOf({ note: "hediye paketi" })).toBeNull()
    expect(giftLineOf({ qt_gift: { recipient_email: "" }, qt_gift_cards: [] })).toBeNull()
  })
})

describe("soldAsGiftCard and orderGiftCards (adr/0025 Ek 2026-11-03)", () => {
  it("tells a gift card line by its recorded recipient or cards, an erased one included", () => {
    expect(soldAsGiftCard({ qt_gift: { erased: true } })).toBe(true)
    expect(soldAsGiftCard({ qt_gift_cards: [] })).toBe(true)
    expect(soldAsGiftCard({ other: 1 })).toBe(false)
    expect(soldAsGiftCard(null)).toBe(false)
  })

  it("says whether an order's gift cards were issued yet, or that it has none", () => {
    const knife = { metadata: null }
    const waiting = { metadata: { qt_gift: { recipient_email: "ayse@example.com" } } }
    const issued = { metadata: { qt_gift_cards: [{ id: "gcard_1", last4: "1234" }] } }
    expect(orderGiftCards([knife, null])).toBeNull()
    expect(orderGiftCards(undefined)).toBeNull()
    expect(orderGiftCards([knife, waiting])).toBe("pending")
    expect(orderGiftCards([waiting, issued])).toBe("issued")
  })
})
