import {
  cardsToVoid,
  cardsVoidedByCancel,
  giftLineUsed,
  giftReturnProblem,
  giftReturnable,
  giftWindowOpen,
  giftWindowState,
  untouchedCard,
  voidingDebits,
} from "../gift-returns"
import type { GiftCardFacts, GiftLineFacts } from "../gift-returns"

const sent = new Date("2026-11-03T10:00:00Z")
const later = (days: number) => new Date(sent.getTime() + days * 24 * 60 * 60 * 1000)

const card = (id: string, over: Partial<GiftCardFacts> = {}): GiftCardFacts => ({
  id,
  account_id: `sc_acc_${id}`,
  value: 500,
  balance: 500,
  spent: false,
  withdrawn: false,
  created_at: sent,
  ...over,
})

const line = (cards: GiftCardFacts[]): GiftLineFacts => ({ line_id: "line_gift", cards })
const gifts = (cards: GiftCardFacts[]) => new Map([["line_gift", line(cards)]])
const asked = (quantity: number) => [{ line_item_id: "line_gift", quantity }]
const back = { kind: "return" as const }

/** adr/0025, the owner 2026-11-03: withdrawal from a gift card only while it is untouched. */
describe("withdrawing from a gift card", () => {
  it("can be asked while every card of the line is untouched, within the period", () => {
    const unused = gifts([card("a"), card("b")])

    expect(giftReturnProblem(asked(2), unused, back, later(13), 14)).toBeNull()
    expect(giftReturnable(line([card("a"), card("b")]), 0, 0)).toBe(2)
    expect(giftWindowOpen(line([card("a")]), later(14), 14)).toBe(true)
  })

  it("says why the line's window is shut: no card sent yet, or its period over", () => {
    expect(giftWindowState(line([]), later(1), 14)).toBe("not_yet")
    expect(giftWindowState(line([card("a")]), later(14), 14)).toBe("open")
    expect(giftWindowState(line([card("a")]), later(15), 14)).toBe("expired")
  })

  it("is out once any card of the line was spent, whatever was left on it", () => {
    const spent = [card("a"), card("b", { spent: true, balance: 500 })]
    const partly = [card("a"), card("b", { balance: 120 })]

    expect(giftLineUsed(line(spent))).toBe(true)
    expect(giftLineUsed(line(partly))).toBe(true)
    expect(giftReturnProblem(asked(1), gifts(spent), back, later(1), 14)).toBe(
      "returns.gift_card_used"
    )
    expect(giftReturnable(line(partly), 0, 0)).toBe(0)
  })

  it("is asked on its own, as money back, and closes with the period from the day the cards went", () => {
    const both = [...asked(1), { line_item_id: "line_pan", quantity: 1 }]

    expect(giftReturnProblem(both, gifts([card("a")]), back, later(1), 14)).toBe(
      "returns.gift_card_separate"
    )
    expect(
      giftReturnProblem(asked(1), gifts([card("a")]), { kind: "exchange" }, later(1), 14)
    ).toBe("returns.gift_card_separate")
    expect(giftReturnProblem(asked(1), gifts([card("a")]), back, later(15), 14)).toBe(
      "returns.window_closed"
    )
    // No card yet (a transfer awaited): nothing to withdraw from
    expect(giftReturnProblem(asked(1), gifts([]), back, later(1), 14)).toBe("returns.window_closed")
    expect(
      giftReturnProblem([{ line_item_id: "line_pan", quantity: 1 }], gifts([]), back, sent, 14)
    ).toBeNull()
  })

  it("counts a card withdrawn before as neither spent nor left, and what earlier requests took", () => {
    const one = [card("a", { withdrawn: true, balance: 0 }), card("b")]

    expect(untouchedCard(card("a", { withdrawn: true, balance: 0 }))).toBe(false)
    expect(giftLineUsed(line(one))).toBe(false)
    expect(giftReturnable(line(one), 1, 0)).toBe(1)
    expect(giftReturnable(line(one), 1, 1)).toBe(0)
  })

  it("voids as many untouched cards as units asked, the first made first; none once one was spent", () => {
    const cards = [
      card("b", { created_at: later(0.1) }),
      card("a"),
      card("c", { withdrawn: true, balance: 0 }),
    ]

    expect(cardsToVoid(asked(1), gifts(cards))?.map((each) => each.id)).toEqual(["a"])
    expect(cardsToVoid(asked(2), gifts(cards))?.map((each) => each.id)).toEqual(["a", "b"])
    expect(cardsToVoid(asked(3), gifts(cards))).toBeNull()
    expect(cardsToVoid(asked(1), gifts([card("a"), card("b", { spent: true })]))).toBeNull()
    expect(cardsToVoid([{ line_item_id: "line_pan", quantity: 1 }], gifts(cards))).toBeNull()
  })
})

/** adr/0025, 2026-11-03: an order whose cards went out is cancelled only while every card is untouched. */
describe("cancelling an order of gift cards", () => {
  it("voids every untouched card, none before they were issued, none withdrawn already", () => {
    const first = line([card("a"), card("b", { withdrawn: true, balance: 0 })])
    const second: GiftLineFacts = {
      line_id: "line_gift_2",
      cards: [card("c", { value: 250, balance: 250 })],
    }

    expect(cardsVoidedByCancel([first, second])?.map((each) => each.id)).toEqual(["a", "c"])
    expect(cardsVoidedByCancel([line([])])).toEqual([])
    expect(cardsVoidedByCancel([])).toEqual([])
  })

  it("is refused once any card was spent, or closed by staff", () => {
    const spent = line([card("a"), card("b", { spent: true, balance: 400 })])
    const closed = line([card("a", { spent: true, balance: 0 })])

    expect(cardsVoidedByCancel([line([card("x")]), spent])).toBeNull()
    expect(cardsVoidedByCancel([closed])).toBeNull()
  })

  it("debits each card's whole balance under the void's reference", () => {
    const by = {
      reference: "order_cancel",
      reference_id: "order_1",
      note: "order order_1 canceled",
    }

    expect(voidingDebits([card("a"), card("c", { balance: 250 })], by)).toEqual([
      { account_id: "sc_acc_a", amount: 500, ...by },
      { account_id: "sc_acc_c", amount: 250, ...by },
    ])
  })
})
