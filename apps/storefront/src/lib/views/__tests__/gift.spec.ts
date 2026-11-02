import { describe, expect, it } from "vitest"
import type { CartLineView } from "@qticaret/ui"
import { withGiftLines } from "../cart"
import { orderGiftOf } from "../order"

const line = (id: string): CartLineView => ({
  id,
  title: "Hediye kartı",
  detail: "500 TL",
  quantity: 1,
  total: "500,00 TL",
  original: null,
  image: null,
})

describe("gift card lines (adr/0025 Ek 2026-11-03)", () => {
  it("puts the recipient under its line on the cart, an unnamed one as null, others untouched", () => {
    const [named, unnamed, plain] = withGiftLines(
      [line("cali_1"), line("cali_2"), line("cali_3")],
      [
        {
          line_id: "cali_1",
          product_id: "prod_g",
          variant_id: "variant_500",
          recipient: {
            recipient_email: "ayse@example.com",
            recipient_name: "Ayşe",
            message: null,
            sender_name: "Can",
          },
        },
        { line_id: "cali_2", product_id: "prod_g", variant_id: "variant_250", recipient: null },
      ]
    )
    expect(named?.gift).toEqual({
      recipient: { email: "ayse@example.com", name: "Ayşe", message: null, sender: "Can" },
    })
    expect(unnamed?.gift).toEqual({ recipient: null })
    expect(plain).not.toHaveProperty("gift")
  })

  it("shows an order line's cards by their last four and where they went, never more", () => {
    expect(
      orderGiftOf({
        qt_gift: { recipient_email: "ayse@example.com", recipient_name: "Ayşe" },
        qt_gift_cards: [{ id: "gc_1", last4: "AB12" }, { id: "gc_2", last4: "toolong" }, null],
      })
    ).toEqual({ cards: ["AB12"], recipient: "ayse@example.com" })
    // Before the payment: no cards yet; after an erasure: no recipient
    expect(orderGiftOf({ qt_gift: { recipient_email: "ayse@example.com" } })).toEqual({
      cards: [],
      recipient: "ayse@example.com",
    })
    expect(orderGiftOf({ qt_gift: { erased: true }, qt_gift_cards: [{ last4: "ZZ99" }] })).toEqual({
      cards: ["ZZ99"],
      recipient: null,
    })
    expect(orderGiftOf({ other: 1 })).toBeNull()
    expect(orderGiftOf(null)).toBeNull()
  })
})
