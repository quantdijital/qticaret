import { describe, expect, it } from "vitest"
import type { Returnable } from "@/features/orders/api/returnable"
import { giftLineIds, isGiftRequest, requestProblem } from "./return-rules"

type Line = Returnable["lines"][number]

const line = (more: Partial<Line>): Line => ({
  line_item_id: "item_1",
  title: "Şef bıçağı",
  variant_title: null,
  variant_id: "variant_1",
  returnable: 1,
  withdrawal_excluded: false,
  withdrawal_excluded_reason: null,
  withdrawal_warning: null,
  gift_card: false,
  variants: [],
  ...more,
})

const knife = line({})
const gift = line({ line_item_id: "item_2", title: "Hediye kartı", gift_card: true })
const spentGift = line({
  line_item_id: "item_3",
  gift_card: true,
  withdrawal_excluded: true,
  withdrawal_excluded_reason: "gift_card_used",
  withdrawal_warning: null,
})
const engraved = line({
  line_item_id: "item_4",
  withdrawal_excluded: true,
  withdrawal_excluded_reason: "personal_addon",
  withdrawal_warning: null,
})

describe("requestProblem: the server's rules said before it refuses", () => {
  it("lets a gift card line go alone as money back, whatever the reason", () => {
    expect(requestProblem([gift], "return", "changed_mind")).toBeNull()
    expect(requestProblem([gift], "return", "")).toBeNull()
  })

  it("keeps a gift card line out of a request with physical lines, and out of an exchange", () => {
    expect(requestProblem([gift, knife], "return", "damaged")).toBe("giftSeparate")
    expect(requestProblem([gift], "exchange", "size_issue")).toBe("giftSeparate")
  })

  it("refuses a gift card line once one of its cards was spent, even as faulty", () => {
    expect(requestProblem([spentGift], "return", "damaged")).toBe("giftUsed")
  })

  it("keeps a line outside the right of withdrawal to faulty returns, never exchanged", () => {
    expect(requestProblem([engraved], "exchange", "damaged")).toBe("excludedExchange")
    expect(requestProblem([engraved], "return", "changed_mind")).toBe("excludedReason")
    expect(requestProblem([engraved], "return", "wrong_item")).toBeNull()
    expect(requestProblem([engraved], "return", "")).toBeNull()
    expect(requestProblem([knife], "exchange", "size_issue")).toBeNull()
  })
})

describe("gift card requests", () => {
  it("finds the order's gift card lines by their metadata, an erased recipient included", () => {
    expect(
      giftLineIds([
        { id: "ordli_1", metadata: null },
        { id: "ordli_2", metadata: { qt_gift: { recipient_email: "ayse@example.com" } } },
        { id: "ordli_3", metadata: { qt_gift: { erased: true }, qt_gift_cards: [] } },
        null,
      ])
    ).toEqual(new Set(["ordli_2", "ordli_3"]))
    expect(giftLineIds(undefined)).toEqual(new Set())
  })

  it("tells a request of gift card lines alone, by its own mark or the order's lines", () => {
    const card = { line_item_id: "ordli_2", quantity: 1 }
    const gifts = new Set(["ordli_2"])
    expect(isGiftRequest({ kind: "return", items: [card] }, gifts)).toBe(true)
    expect(isGiftRequest({ kind: "return", items: [{ ...card, gift_card: true }] })).toBe(true)
    expect(isGiftRequest({ kind: "return", items: [card] })).toBe(false)
    const mixed = [card, { line_item_id: "ordli_1", quantity: 1 }]
    expect(isGiftRequest({ kind: "return", items: mixed }, gifts)).toBe(false)
    expect(isGiftRequest({ kind: "exchange", items: [card] }, gifts)).toBe(false)
    expect(isGiftRequest({ kind: "return", items: [] }, gifts)).toBe(false)
  })
})
