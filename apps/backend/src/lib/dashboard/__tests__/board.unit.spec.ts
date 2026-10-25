import { boardSlice } from "../board"
import type { LifecycleOrder } from "../lifecycle"

const paid = [{ status: "authorized", amount: 100, captured_amount: 0, refunded_amount: 0 }]
const unpaid = [{ status: "not_paid", amount: 100, captured_amount: 0, refunded_amount: 0 }]
const item = (fulfilled: number, shipped = fulfilled) => [
  { quantity: 1, detail: { fulfilled_quantity: fulfilled, shipped_quantity: shipped } },
]

const order = (id: string, extra: Partial<LifecycleOrder> = {}) => ({
  id,
  status: "pending",
  currency_code: "try",
  payment_collections: paid,
  items: item(0),
  ...extra,
})

// Newest first, as the route reads them
const orders = [
  order("o5"),
  order("o4", { payment_collections: unpaid }),
  order("o3", { items: item(1) }),
  order("o2"),
  order("o1", { status: "canceled" }),
]

describe("boardSlice", () => {
  it("counts every tab whichever one is asked", () => {
    expect(boardSlice(orders, "to_ship", 0, 20).counts).toEqual({
      all: 5,
      awaiting_payment: 1,
      to_ship: 2,
      shipped: 1,
      delivered: 0,
      canceled: 1,
    })
  })

  it("keeps the asked stage in the order given, with each order's stage", () => {
    const slice = boardSlice(orders, "to_ship", 0, 20)

    expect(slice.count).toBe(2)
    expect(slice.page).toEqual([
      { id: "o5", stage: "to_ship" },
      { id: "o2", stage: "to_ship" },
    ])
  })

  it("pages through all orders", () => {
    const slice = boardSlice(orders, "all", 2, 2)

    expect(slice.count).toBe(5)
    expect(slice.page.map((row) => row.id)).toEqual(["o3", "o2"])
  })

  it("answers an empty page past the end", () => {
    expect(boardSlice(orders, "canceled", 5, 20).page).toEqual([])
  })
})
