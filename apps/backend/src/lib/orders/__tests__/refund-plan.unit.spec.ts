import { kurus } from "../../money"
import { planRefund } from "../refund-plan"
import type { LineShare } from "../shares"

// Two cups paid 90 each after a discount (200 → 180), shipping 30
const shares: LineShare[] = [
  {
    id: "item_1",
    kind: "item",
    quantity: 2,
    gross: kurus(20000),
    discount: kurus(2000),
    net: kurus(18000),
  },
  {
    id: "ship_1",
    kind: "shipping",
    quantity: 1,
    gross: kurus(3000),
    discount: kurus(0),
    net: kurus(3000),
  },
]
const nothing = { units: new Map<string, number>(), net: new Map<string, number>() }
const reasonOf = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    return (error as { safeMessage?: string }).safeMessage
  }
  return "no error"
}

describe("planRefund (F5 V5)", () => {
  it("gives back what a unit paid, never its list price", () => {
    expect(
      planRefund(shares, nothing, { items: [{ id: "item_1", quantity: 1 }] }, kurus(21000))
    ).toEqual({
      lines: [{ id: "item_1", kind: "item", quantity: 1, net: kurus(9000) }],
      total: kurus(9000),
    })
  })

  it("counts units after those refunded before, and refuses more than the line holds", () => {
    const one = { units: new Map([["item_1", 1]]), net: new Map([["item_1", 9000]]) }

    expect(
      planRefund(shares, one, { items: [{ id: "item_1", quantity: 1 }] }, kurus(12000)).total
    ).toBe(9000)
    expect(
      reasonOf(() =>
        planRefund(shares, one, { items: [{ id: "item_1", quantity: 2 }] }, kurus(12000))
      )
    ).toBe("orders.refund_units_exceeded")
  })

  it("lets a free amount lower what the line's units give back later", () => {
    const free = planRefund(shares, nothing, { amount: kurus(4200) }, kurus(21000))
    const refunded = {
      units: new Map<string, number>(),
      net: new Map(free.lines.map((line) => [line.id, line.net])),
    }

    expect(free.lines).toEqual([
      { id: "item_1", kind: "item", quantity: 0, net: kurus(3600) },
      { id: "ship_1", kind: "shipping", quantity: 0, net: kurus(600) },
    ])
    expect(
      planRefund(
        shares,
        refunded,
        { items: [{ id: "item_1", quantity: 2 }], shipping: true },
        kurus(16800)
      )
    ).toMatchObject({ total: kurus(16800) })
  })

  it("books what an edit or a swap took off against no line, within what was paid", () => {
    expect(planRefund(shares, nothing, { balance: kurus(4000) }, kurus(21000))).toEqual({
      lines: [],
      total: kurus(4000),
    })
    expect(reasonOf(() => planRefund(shares, nothing, { balance: kurus(4000) }, kurus(3000)))).toBe(
      "orders.refund_exceeds_paid"
    )
  })

  it("refuses an empty refund, an unknown line and more than was paid", () => {
    expect(reasonOf(() => planRefund(shares, nothing, { items: [] }, kurus(21000)))).toBe(
      "orders.refund_empty"
    )
    expect(
      reasonOf(() =>
        planRefund(shares, nothing, { items: [{ id: "x", quantity: 1 }] }, kurus(21000))
      )
    ).toBe("orders.refund_line_unknown")
    expect(
      reasonOf(() => planRefund(shares, nothing, { amount: kurus(25000) }, kurus(21000)))
    ).toBe("orders.refund_exceeds_paid")
    expect(reasonOf(() => planRefund(shares, nothing, { shipping: true }, kurus(1000)))).toBe(
      "orders.refund_exceeds_paid"
    )
  })

  it("keeps a dated cancel tier's share of each line, rounded half up to the kuruş (adr/0076)", () => {
    // 2 × 90 = 180 at 25%: 45 kept, 135 back; 1 unit (90,00) at 33%: 29,70 kept, 60,30 back
    expect(
      planRefund(
        shares,
        nothing,
        { items: [{ id: "item_1", quantity: 2 }], fee_percent: 25 },
        kurus(21000)
      )
    ).toEqual({
      lines: [{ id: "item_1", kind: "item", quantity: 2, net: kurus(13500) }],
      total: kurus(13500),
    })
    expect(
      planRefund(
        shares,
        nothing,
        { items: [{ id: "item_1", quantity: 1 }], fee_percent: 33 },
        kurus(21000)
      ).total
    ).toBe(6030)
    // Everything kept: nothing to give back
    expect(
      reasonOf(() =>
        planRefund(
          shares,
          nothing,
          { items: [{ id: "item_1", quantity: 1 }], fee_percent: 100 },
          kurus(21000)
        )
      )
    ).toBe("orders.refund_empty")
    expect(() =>
      planRefund(
        shares,
        nothing,
        { items: [{ id: "item_1", quantity: 1 }], fee_percent: 101 },
        kurus(21000)
      )
    ).toThrow(RangeError)
  })
})
