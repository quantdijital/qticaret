import { orderState } from "../order-state"
import type { StateOrder } from "../order-state"

const AT = "2026-10-20T10:00:00.000Z"
const paid = [
  {
    status: "authorized",
    amount: 100,
    captured_amount: 0,
    refunded_amount: 0,
    payments: [{ id: "pay_1", captured_at: null }],
  },
]
const order = (extra: Partial<StateOrder> = {}): StateOrder => ({
  id: "order_1",
  status: "pending",
  currency_code: "try",
  payment_collections: paid,
  items: [
    { id: "item_a", quantity: 2, detail: { fulfilled_quantity: 0 } },
    { id: "item_b", quantity: 1, detail: { fulfilled_quantity: 0 } },
  ],
  fulfillments: [],
  ...extra,
})

describe("orderState", () => {
  it("offers to ship everything left, to take the held payment and to cancel", () => {
    expect(orderState(order())).toEqual({
      stage: "to_ship",
      ship: {
        fulfillment_id: null,
        items: [
          { id: "item_a", quantity: 2 },
          { id: "item_b", quantity: 1 },
        ],
      },
      pickup: [],
      deliver: [],
      capture: ["pay_1"],
      cancelable: true,
    })
  })

  it("leaves a parcel with a carrier's label to its pickup, and packs what is left", () => {
    const state = orderState(
      order({
        items: [
          { id: "item_a", quantity: 2, detail: { fulfilled_quantity: 2 } },
          { id: "item_b", quantity: 1, detail: { fulfilled_quantity: 0 } },
        ],
        fulfillments: [
          {
            id: "ful_1",
            provider_id: "geliver_geliver",
            items: [{ line_item_id: "item_a", quantity: 2 }],
          },
        ],
      })
    )

    expect(state.pickup).toEqual(["ful_1"])
    expect(state.ship).toEqual({ fulfillment_id: null, items: [{ id: "item_b", quantity: 1 }] })
  })

  it("hands over a packed parcel first, with its own items", () => {
    const state = orderState(
      order({
        items: [
          { id: "item_a", quantity: 2, detail: { fulfilled_quantity: 2 } },
          { id: "item_b", quantity: 1, detail: { fulfilled_quantity: 0 } },
        ],
        fulfillments: [{ id: "ful_1", items: [{ line_item_id: "item_a", quantity: 2 }] }],
      })
    )

    expect(state.ship).toEqual({ fulfillment_id: "ful_1", items: [{ id: "item_a", quantity: 2 }] })
    expect(state.cancelable).toBe(false)
  })

  it("lists parcels on their way for delivery and nothing to ship once all left", () => {
    const state = orderState(
      order({
        items: [
          { id: "item_a", quantity: 1, detail: { fulfilled_quantity: 1, shipped_quantity: 1 } },
        ],
        fulfillments: [
          { id: "ful_1", shipped_at: AT },
          { id: "ful_old", shipped_at: AT, canceled_at: AT },
        ],
      })
    )

    expect(state).toMatchObject({ stage: "shipped", ship: null, deliver: ["ful_1"] })
  })

  it("offers nothing for a canceled order", () => {
    expect(orderState(order({ status: "canceled" }))).toEqual({
      stage: "canceled",
      ship: null,
      pickup: [],
      deliver: [],
      capture: [],
      cancelable: false,
    })
  })

  it("leaves lines that need no shipping out of the parcel", () => {
    const state = orderState(
      order({
        items: [
          { id: "item_a", quantity: 1, detail: { fulfilled_quantity: 0 } },
          {
            id: "item_code",
            quantity: 1,
            requires_shipping: false,
            detail: { fulfilled_quantity: 0 },
          },
        ],
      })
    )

    expect(state.ship?.items).toEqual([{ id: "item_a", quantity: 1 }])
  })
})
