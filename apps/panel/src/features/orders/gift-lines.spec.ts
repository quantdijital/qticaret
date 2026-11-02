import { describe, expect, it } from "vitest"
import { giftLineOf } from "./gift-lines"

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
