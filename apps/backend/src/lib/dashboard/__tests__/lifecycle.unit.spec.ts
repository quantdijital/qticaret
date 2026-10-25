import { lifecycleOf } from "../lifecycle"
import type { LifecycleOrder } from "../lifecycle"

const paid = [{ status: "authorized", amount: 100, captured_amount: 0, refunded_amount: 0 }]
const line = (quantity: number, fulfilled = 0, shipped = 0, delivered = 0) => ({
  quantity,
  detail: {
    fulfilled_quantity: fulfilled,
    shipped_quantity: shipped,
    delivered_quantity: delivered,
  },
})
const order = (extra: Partial<LifecycleOrder> = {}): LifecycleOrder => ({
  status: "pending",
  currency_code: "try",
  payment_collections: paid,
  items: [line(2)],
  ...extra,
})

describe("lifecycleOf", () => {
  it("reads payment: held or taken is to ship, nothing yet is awaiting payment", () => {
    expect(lifecycleOf(order())).toBe("to_ship")
    expect(
      lifecycleOf(
        order({ payment_collections: [{ status: "not_paid", amount: 100, captured_amount: 0 }] })
      )
    ).toBe("awaiting_payment")
  })

  it("keeps a partly refunded, unsent order to ship", () => {
    const refunded = [
      { status: "partially_refunded", amount: 100, captured_amount: 100, refunded_amount: 20 },
    ]

    expect(lifecycleOf(order({ payment_collections: refunded }))).toBe("to_ship")
  })

  it("follows each item: something left keeps it to ship, all sent is shipped, all delivered is delivered", () => {
    expect(lifecycleOf(order({ items: [line(2, 2, 2), line(1)] }))).toBe("to_ship")
    expect(lifecycleOf(order({ items: [line(2, 2, 0)] }))).toBe("to_ship")
    expect(lifecycleOf(order({ items: [line(2, 2, 2, 1), line(1, 1, 1, 1)] }))).toBe("shipped")
    expect(lifecycleOf(order({ items: [line(2, 2, 2, 2), line(1, 1, 1, 1)] }))).toBe("delivered")
  })

  it("puts a canceled order first", () => {
    expect(lifecycleOf(order({ status: "canceled", items: [line(1, 1, 1, 1)] }))).toBe("canceled")
  })
})
