import { kurus } from "../../../money"
import { aroundDay, matchStatement } from "../match"
import type { ShopPayment, StatementRow } from "../match"

const DAY = "2026-10-28"

const payment = (reference: string, amount: number, over: Partial<ShopPayment> = {}) => ({
  reference,
  order: { id: `order_${reference}`, display_id: 100 },
  captures: [{ amount: kurus(amount), day: DAY }],
  refunds: [],
  ...over,
})

const sale = (reference: string, amount: number, over: Partial<StatementRow> = {}) => ({
  kind: "sale" as const,
  reference,
  amount: kurus(amount),
  day: DAY,
  ...over,
})

const refund = (reference: string, amount: number, day = DAY) => ({
  kind: "refund" as const,
  reference,
  amount: kurus(amount),
  day,
})

describe("a statement against the shop's payments", () => {
  it("agrees when every payment of the day is a sale of the same amount", () => {
    const result = matchStatement(
      DAY,
      [payment("A1", 12000), payment("A2", 5050)],
      [sale("A1", 12000), sale("A2", 5050)]
    )

    expect(result).toEqual({ matched: 2, sales: 2, issues: [] })
  })

  it("takes a sale booked just after midnight, on the next day", () => {
    const result = matchStatement(
      DAY,
      [payment("A1", 12000)],
      [sale("A1", 12000, { day: "2026-10-29" })]
    )

    expect(result).toEqual({ matched: 1, sales: 0, issues: [] })
  })

  it("takes either amount PayTR shows for a sale paid in installments", () => {
    const result = matchStatement(
      DAY,
      [payment("A1", 12000)],
      [sale("A1", 12563, { alternative: kurus(12000) })]
    )

    expect(result.issues).toEqual([])
  })

  it("names a payment the provider does not show, and one of another amount", () => {
    const result = matchStatement(
      DAY,
      [payment("A1", 12000), payment("A2", 5050)],
      [sale("A2", 5000)]
    )

    expect(result.matched).toBe(0)
    expect(result.issues).toEqual([
      {
        kind: "missing_at_provider",
        reference: "A1",
        order_id: "order_A1",
        display_id: 100,
        shop: 12000,
        provider: 0,
      },
      {
        kind: "amount_mismatch",
        reference: "A2",
        order_id: "order_A2",
        display_id: 100,
        shop: 5050,
        provider: 5000,
      },
    ])
  })

  it("names money the provider took that the shop has no payment for, unless it is a recovered one", () => {
    const result = matchStatement(DAY, [], [sale("X1", 9900), sale("X2", 100)], new Set(["X2"]))

    expect(result.issues).toEqual([
      {
        kind: "unknown_at_shop",
        reference: "X1",
        order_id: null,
        display_id: null,
        shop: 0,
        provider: 9900,
      },
    ])
  })

  it("leaves a sale of another day to that day's check", () => {
    const result = matchStatement(DAY, [], [sale("X1", 9900, { day: "2026-10-27" })])

    expect(result).toEqual({ matched: 0, sales: 0, issues: [] })
  })

  it("compares the refunds of a reference refunded that day on either side", () => {
    const refunded = payment("A1", 12000, {
      captures: [{ amount: kurus(12000), day: "2026-10-27" }],
      refunds: [{ amount: kurus(3000), day: DAY }],
    })
    const agreed = matchStatement(DAY, [refunded], [sale("A1", 12000), refund("A1", 3000)])
    const short = matchStatement(DAY, [refunded], [sale("A1", 12000)])
    const extra = matchStatement(DAY, [payment("A2", 5000)], [sale("A2", 5000), refund("A2", 5000)])

    expect(agreed.issues).toEqual([])
    expect(short.issues).toMatchObject([{ kind: "refund_mismatch", shop: 3000, provider: 0 }])
    expect(extra.issues).toMatchObject([{ kind: "refund_mismatch", shop: 0, provider: 5000 }])
  })

  it("leaves the refund of a recovered payment to the recovery records", () => {
    const result = matchStatement(DAY, [], [refund("X2", 100)], new Set(["X2"]))

    expect(result.issues).toEqual([])
  })

  it("names the days either side, across a month", () => {
    expect(aroundDay("2026-11-01")).toEqual({ before: "2026-10-31", after: "2026-11-02" })
  })
})
