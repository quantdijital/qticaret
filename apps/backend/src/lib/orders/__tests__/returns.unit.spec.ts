import { cameBack, linesProblem, returnable, windowOpen } from "../returns"

const DAY = 24 * 60 * 60 * 1000
const now = new Date("2026-10-28T12:00:00.000Z")
const ago = (days: number) => new Date(now.getTime() - days * DAY).toISOString()

const order = {
  items: [
    { id: "line_a", detail: { shipped_quantity: 3 } },
    { id: "line_b", detail: { shipped_quantity: 0 } },
  ],
  fulfillments: [{ shipped_at: ago(5), delivered_at: ago(3) }],
}

describe("returns (adr/0032)", () => {
  it("returns what was shipped, less what was already asked for", () => {
    expect(returnable(order, [])).toEqual(new Map([["line_a", 3]]))
    expect(returnable(order, [{ line_item_id: "line_a", quantity: 2 }])).toEqual(
      new Map([["line_a", 1]])
    )
    expect(returnable(order, [{ line_item_id: "line_a", quantity: 3 }]).size).toBe(0)
  })

  it("counts Medusa's own returns of a line when they hold more than the requests", () => {
    const returned = {
      ...order,
      items: [
        {
          id: "line_a",
          detail: {
            shipped_quantity: 3,
            return_requested_quantity: 1,
            return_received_quantity: 1,
            return_dismissed_quantity: 0,
          },
        },
      ],
    }
    // Our approved request of 2 is Medusa's return of 2: counted once
    expect(returnable(returned, [{ line_item_id: "line_a", quantity: 2 }])).toEqual(
      new Map([["line_a", 1]])
    )
    // A return opened elsewhere still counts
    expect(returnable(returned, [])).toEqual(new Map([["line_a", 1]]))
  })

  it("counts a received request by what came back, sound and damaged together", () => {
    const asked = [{ line_item_id: "line_a", quantity: 3 }]
    expect(cameBack({ items: asked })).toEqual(asked)
    expect(
      cameBack({
        items: asked,
        received_items: [{ line_item_id: "line_a", quantity: 1 }],
        damaged_items: [{ line_item_id: "line_a", quantity: 1 }],
      })
    ).toEqual([{ line_item_id: "line_a", quantity: 2 }])
  })

  it("is open 14 days after the last parcel arrived, and while one is on its way", () => {
    expect(windowOpen(order, now)).toBe(true)
    expect(
      windowOpen({ ...order, fulfillments: [{ shipped_at: ago(20), delivered_at: ago(15) }] }, now)
    ).toBe(false)
    expect(
      windowOpen({ ...order, fulfillments: [{ shipped_at: ago(20), delivered_at: null }] }, now)
    ).toBe(true)
    expect(windowOpen({ ...order, fulfillments: [] }, now)).toBe(false)
  })

  it("takes a parcel never marked delivered as arrived 30 days after it left", () => {
    const unmarked = (days: number) => ({
      ...order,
      fulfillments: [{ shipped_at: ago(days), delivered_at: null }],
    })
    expect(windowOpen(unmarked(44), now)).toBe(true)
    expect(windowOpen(unmarked(45), now)).toBe(false)
  })

  it("refuses lines asked twice, nothing at all, or more than is left", () => {
    const left = new Map([["line_a", 2]])
    expect(linesProblem(left, [{ line_item_id: "line_a", quantity: 2 }])).toBeNull()
    expect(linesProblem(left, [{ line_item_id: "line_a", quantity: 3 }])).toBe(
      "returns.items_invalid"
    )
    expect(linesProblem(left, [{ line_item_id: "line_b", quantity: 1 }])).toBe(
      "returns.items_invalid"
    )
    expect(linesProblem(left, [])).toBe("returns.items_invalid")
    expect(
      linesProblem(left, [
        { line_item_id: "line_a", quantity: 1 },
        { line_item_id: "line_a", quantity: 1 },
      ])
    ).toBe("returns.items_invalid")
  })
})
