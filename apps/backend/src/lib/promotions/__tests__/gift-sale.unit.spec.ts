import {
  GIFT_CARDS_KEY,
  GIFT_RECIPIENT_KEY,
  giftIssueKey,
  giftIssuePlan,
  giftLineProblem,
  giftRecipientOf,
  giftTextProblem,
  issuedCardsOf,
  last4,
  plainGiftText,
  withoutRecipient,
} from "../gift-sale"
import type { GiftCartFacts, GiftOrderFacts } from "../gift-sale"

const recipient = { recipient_email: " Zeynep@Example.com ", message: "İyi ki doğdun" }
const giftLine = (metadata: unknown = { [GIFT_RECIPIENT_KEY]: recipient }) => ({
  id: "cali_gift",
  product_id: "prod_gift",
  metadata,
})
const otherLine = { id: "cali_cup", product_id: "prod_cup", metadata: null }

const cart = (over: Partial<GiftCartFacts> = {}): GiftCartFacts => ({
  lines: [giftLine(), otherLine],
  giftProducts: new Set(["prod_gift"]),
  hasCredit: false,
  way: "pp_paytr_paytr",
  saleOn: true,
  ...over,
})

describe("gift line rules (adr/0025 Ek 2026-11-03)", () => {
  it("lets a cart without gift lines through whatever else holds", () => {
    expect(
      giftLineProblem(cart({ lines: [otherLine], saleOn: false, hasCredit: true, way: "credit" }))
    ).toBeNull()
  })

  it("lets a gift line with its recipient be paid by card or transfer", () => {
    expect(giftLineProblem(cart())).toBeNull()
    expect(giftLineProblem(cart({ way: null }))).toBeNull()
  })

  it("stops a gift line while the shop's gift cards are off", () => {
    expect(giftLineProblem(cart({ saleOn: false }))).toEqual({
      key: "gift_card.sale_disabled",
      field: "items",
    })
  })

  it("stops a gift line without a recipient, or with one that is no address", () => {
    for (const metadata of [null, {}, { [GIFT_RECIPIENT_KEY]: { recipient_email: "nope" } }]) {
      expect(giftLineProblem(cart({ lines: [giftLine(metadata)] }))?.key).toBe(
        "gift_card.recipient_required"
      )
    }
  })

  it("never pays a gift card with gift cards or store credit, whole or in part", () => {
    expect(giftLineProblem(cart({ way: "credit" }))).toEqual({
      key: "gift_card.not_payable_with_credit",
      field: "provider_id",
    })
    expect(giftLineProblem(cart({ hasCredit: true }))).toEqual({
      key: "gift_card.not_payable_with_credit",
      field: "gift_cards",
    })
    // Before the recipient: no use asking for one on a cart that cannot be paid so
    expect(giftLineProblem(cart({ hasCredit: true, lines: [giftLine(null)] }))?.key).toBe(
      "gift_card.not_payable_with_credit"
    )
  })
})

describe("a gift line's recipient", () => {
  it("reads the address in its one spelling and the texts as plain lines", () => {
    expect(
      giftRecipientOf({
        [GIFT_RECIPIENT_KEY]: {
          ...recipient,
          recipient_name: "  Zeynep\n Kaya ",
          sender_name: "Ayşe",
        },
      })
    ).toEqual({
      recipient_email: "zeynep@example.com",
      recipient_name: "Zeynep Kaya",
      message: "İyi ki doğdun",
      sender_name: "Ayşe",
    })
  })

  it("drops a text that reads as a link, is too long or hides characters", () => {
    const read = (message: string) =>
      giftRecipientOf({ [GIFT_RECIPIENT_KEY]: { ...recipient, message } })?.message
    expect(read("bkz. https://kotu.example")).toBeNull()
    expect(read("yaz bana: a@b.co")).toBeNull()
    expect(read("x".repeat(301))).toBeNull()
    expect(read("gizli‮metin")).toBeNull()
  })

  it("says why typed text cannot travel, and makes it one line", () => {
    expect(plainGiftText("  Mutlu\r\n\tyıllar  ")).toBe("Mutlu yıllar")
    expect(giftTextProblem("Mutlu yıllar!")).toBeNull()
    expect(giftTextProblem("www.kotu.example")).toBe("gift_card.text_link")
    expect(giftTextProblem("a\u0000b")).toBe("gift_card.text_invalid")
    expect(giftTextProblem("a​b")).toBe("gift_card.text_invalid")
  })
})

const order = (over: Partial<GiftOrderFacts> = {}): GiftOrderFacts => ({
  order_id: "order_1",
  canceled: false,
  test_mode: false,
  due: 100_000,
  paid: 100_000,
  refunded: 0,
  lines: [
    { id: "ordli_gift", quantity: 2, unit_kurus: 50_000, gift: true, issued: 0 },
    { id: "ordli_cup", quantity: 1, unit_kurus: 12_000, gift: false, issued: 0 },
  ],
  ...over,
})

describe("issuing a paid order's cards", () => {
  it("issues one card per unit, each with its own key", () => {
    expect(giftIssuePlan(order())).toEqual({
      state: "issue",
      units: [
        { line_id: "ordli_gift", index: 0, value_kurus: 50_000, key: "order_1:ordli_gift:0" },
        { line_id: "ordli_gift", index: 1, value_kurus: 50_000, key: "order_1:ordli_gift:1" },
      ],
    })
  })

  it("issues only what is missing: a run again makes none twice", () => {
    const lines = order().lines.map((line) => (line.gift ? { ...line, issued: 1 } : line))
    const plan = giftIssuePlan(order({ lines }))
    expect(plan).toEqual({
      state: "issue",
      units: [
        {
          line_id: "ordli_gift",
          index: 1,
          value_kurus: 50_000,
          key: giftIssueKey("order_1", "ordli_gift", 1),
        },
      ],
    })
    const done = order().lines.map((line) => (line.gift ? { ...line, issued: 2 } : line))
    expect(giftIssuePlan(order({ lines: done })).state).toBe("issued")
  })

  it("waits for the money, and issues nothing for a canceled, refunded or test order", () => {
    expect(giftIssuePlan(order({ paid: 0 })).state).toBe("unpaid")
    expect(giftIssuePlan(order({ paid: 99_999 })).state).toBe("unpaid")
    expect(giftIssuePlan(order({ due: 0, paid: 0 })).state).toBe("unpaid")
    expect(giftIssuePlan(order({ canceled: true })).state).toBe("canceled")
    expect(giftIssuePlan(order({ test_mode: true })).state).toBe("test_mode")
    expect(giftIssuePlan(order({ refunded: 12_000 })).state).toBe("refunded")
  })

  it("has nothing to do for an order without gift lines", () => {
    const lines = order().lines.filter((line) => !line.gift)
    expect(giftIssuePlan(order({ lines, paid: 0 })).state).toBe("none")
  })
})

describe("what a line keeps of its cards", () => {
  it("records ids and last four characters, never a code", () => {
    expect(last4("GIFT-ABCD-EFGH-JKLM-NPQR")).toBe("NPQR")
    expect(
      issuedCardsOf({
        [GIFT_CARDS_KEY]: [{ id: "gcard_1", last4: "NPQR" }, { id: 2 }, "gcard_3"],
      })
    ).toEqual([{ id: "gcard_1", last4: "NPQR" }])
    expect(issuedCardsOf(null)).toEqual([])
  })

  it("erases the recipient and keeps the cards", () => {
    const metadata = {
      [GIFT_RECIPIENT_KEY]: recipient,
      [GIFT_CARDS_KEY]: [{ id: "gcard_1", last4: "NPQR" }],
      other: 1,
    }
    expect(withoutRecipient(metadata)).toEqual({
      [GIFT_RECIPIENT_KEY]: { erased: true },
      [GIFT_CARDS_KEY]: [{ id: "gcard_1", last4: "NPQR" }],
      other: 1,
    })
    expect(withoutRecipient({ other: 1 })).toBeNull()
    expect(giftRecipientOf(withoutRecipient(metadata))).toBeNull()
  })
})
