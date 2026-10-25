import { describe, expect, it } from "vitest"
import { inTransit, lifecycleOf, milestones, uncaptured, unshippedItems } from "./order-math"
import type { OrderFacts } from "./order-math"

const AT = "2026-10-20T10:00:00.000Z"
const LATER = "2026-10-21T10:00:00.000Z"

const order = (extra: Partial<OrderFacts> = {}): OrderFacts & { created_at: string } => ({
  status: "pending",
  created_at: AT,
  items: [
    { id: "item_a", quantity: 2, detail: { fulfilled_quantity: 0 } },
    { id: "item_b", quantity: 1, detail: { fulfilled_quantity: 0 } },
  ],
  fulfillments: [],
  payment_collections: [{ status: "authorized", payments: [{ id: "pay_1", captured_at: null }] }],
  ...extra,
})

const fulfilled = [
  { id: "item_a", quantity: 2, detail: { fulfilled_quantity: 2 } },
  { id: "item_b", quantity: 1, detail: { fulfilled_quantity: 1 } },
]

describe("lifecycleOf", () => {
  it("reads a held payment as ready to ship, and none as awaiting payment", () => {
    expect(lifecycleOf(order())).toBe("to_ship")
    expect(
      lifecycleOf(order({ payment_collections: [{ status: "not_paid", payments: [] }] }))
    ).toBe("awaiting_payment")
  })

  it("follows parcels: shipped, then delivered once every item is delivered", () => {
    const shipped = order({ items: fulfilled, fulfillments: [{ id: "ful_1", shipped_at: AT }] })
    const delivered = order({
      items: fulfilled,
      fulfillments: [{ id: "ful_1", shipped_at: AT, delivered_at: LATER }],
    })

    expect(lifecycleOf(shipped)).toBe("shipped")
    expect(lifecycleOf(delivered)).toBe("delivered")
  })

  it("ignores canceled parcels and puts a canceled order first", () => {
    expect(
      lifecycleOf(order({ fulfillments: [{ id: "ful_1", shipped_at: AT, canceled_at: LATER }] }))
    ).toBe("to_ship")
    expect(lifecycleOf(order({ status: "canceled" }))).toBe("canceled")
  })
})

describe("what is left to do", () => {
  it("lists unshipped quantities, parcels in transit and payments not taken", () => {
    const partly = order({
      items: [
        { id: "item_a", quantity: 2, detail: { fulfilled_quantity: 1 } },
        { id: "item_b", quantity: 1, detail: { fulfilled_quantity: 1 } },
      ],
      fulfillments: [
        { id: "ful_1", shipped_at: AT },
        { id: "ful_2", shipped_at: AT, delivered_at: LATER },
      ],
    })

    expect(unshippedItems(partly)).toEqual([{ id: "item_a", quantity: 1 }])
    expect(inTransit(partly)).toEqual(["ful_1"])
    expect(uncaptured(partly)).toEqual(["pay_1"])
  })

  it("dates each step from the earliest record", () => {
    const done = order({
      items: fulfilled,
      fulfillments: [{ id: "ful_1", shipped_at: LATER, delivered_at: LATER }],
      payment_collections: [{ status: "completed", payments: [{ id: "pay_1", captured_at: AT }] }],
    })

    expect(milestones(done)).toEqual({ placed: AT, paid: AT, shipped: LATER, delivered: LATER })
    expect(milestones(order({ payment_collections: [] }))).toMatchObject({
      paid: null,
      shipped: null,
    })
  })
})
