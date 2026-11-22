import {
  cancelledSlotsWithLiveUses,
  liveUsesOfOrder,
  orderHasCancelledDeparture,
  releaseSlotHolds,
} from "../cancel-uses"
import type { Executor } from "../sql"

/** An executor answering each statement in turn, keeping what it was asked. */
function fakeManager(answers: unknown[][]) {
  const calls: { sql: string; params: unknown[] }[] = []
  const manager: Executor = {
    execute: (sql, params) => {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params })
      return Promise.resolve(answers.shift() ?? [])
    },
  }
  return { manager, calls }
}

describe("a cancelled departure's carts' holds (review D5)", () => {
  it("gives up every hold's places on the slot and lowers `held` by them", async () => {
    const { manager, calls } = fakeManager([[{ units: 2 }, { units: "3" }]])

    expect(await releaseSlotHolds(manager, "bkslot_1")).toBe(5)
    expect(calls[0]?.sql).toBe("DELETE FROM booking_hold_slot WHERE slot_id = ? RETURNING units")
    expect(calls[0]?.params).toEqual(["bkslot_1"])
    expect(calls[1]?.sql).toContain("SET held = GREATEST(held - ?, 0)")
    expect(calls[1]?.params).toEqual([5, "bkslot_1"])
  })

  it("writes nothing more when no cart held a place", async () => {
    const { manager, calls } = fakeManager([[]])

    expect(await releaseSlotHolds(manager, "bkslot_1")).toBe(0)
    expect(calls).toHaveLength(1)
  })
})

describe("the departure cancel's resume sweep (review D4)", () => {
  it("reads cancelled slots with a live booking in a stable order, oldest first", async () => {
    const { manager, calls } = fakeManager([[{ id: "bkslot_a" }, { id: "bkslot_b" }]])

    expect(await cancelledSlotsWithLiveUses(manager, 100)).toEqual(["bkslot_a", "bkslot_b"])
    expect(calls[0]?.sql).toContain("ORDER BY s.updated_at, s.id LIMIT ?")
    expect(calls[0]?.params).toEqual([100])
  })
})

describe("an order's departures", () => {
  it("reads each live departure with its use row and the terms it was sold under", async () => {
    const terms = { timezone: "Europe/Istanbul", tiers: [] }
    const { manager } = fakeManager([
      [
        {
          use_id: "bkuse_1",
          booking_id: "bkng_1",
          order_id: "order_1",
          slot_id: "bkslot_1",
          units: "2",
          cancellation: JSON.stringify(terms),
        },
        {
          use_id: "bkuse_2",
          booking_id: "bkng_1",
          order_id: "order_1",
          slot_id: "bkslot_2",
          units: 1,
          cancellation: null,
        },
      ],
    ])

    expect(await liveUsesOfOrder(manager, "order_1")).toEqual([
      {
        use_id: "bkuse_1",
        booking_id: "bkng_1",
        order_id: "order_1",
        slot_id: "bkslot_1",
        units: 2,
        cancellation: terms,
      },
      {
        use_id: "bkuse_2",
        booking_id: "bkng_1",
        order_id: "order_1",
        slot_id: "bkslot_2",
        units: 1,
        cancellation: null,
      },
    ])
  })

  it("knows when one of them was cancelled, on its own or with its booking (review O3)", async () => {
    const found = fakeManager([[{ found: 1 }]])
    const none = fakeManager([[]])

    expect(await orderHasCancelledDeparture(found.manager, "order_1")).toBe(true)
    expect(await orderHasCancelledDeparture(none.manager, "order_1")).toBe(false)
    expect(found.calls[0]?.sql).toContain("(u.cancelled_at IS NOT NULL OR b.status = 'cancelled')")
    expect(found.calls[0]?.params).toEqual(["order_1"])
  })
})
