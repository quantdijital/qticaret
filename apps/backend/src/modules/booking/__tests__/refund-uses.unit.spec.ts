import { cancelBookingSlot } from "../cancel-uses"
import {
  cancelledUsesByHand,
  cancelledUsesOfOrder,
  markBellsChecked,
  markUseOwedByHand,
} from "../refund-uses"
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

describe("a departure's cancel keeps how its money went back (refund safety follow-up)", () => {
  it("writes the way with cancelled_at, in the same statement", async () => {
    const { manager, calls } = fakeManager([
      [{ id: "bkng_1", status: "confirmed" }],
      [{ units: 2 }],
      [],
      [{ live: 1 }],
    ])

    expect(await cancelBookingSlot(manager, "bkng_1", "bkslot_1", "credit")).toBe(true)
    expect(calls[1]?.sql).toContain("SET cancelled_at = now(), cancel_refund = ?")
    expect(calls[1]?.params).toEqual(["credit", "bkng_1", "bkslot_1"])
  })

  it("keeps null when no way is given, and refuses a way it does not know", async () => {
    const { manager, calls } = fakeManager([[{ id: "bkng_1", status: "confirmed" }], []])

    expect(await cancelBookingSlot(manager, "bkng_1", "bkslot_1")).toBe(false)
    expect(calls[1]?.params).toEqual([null, "bkng_1", "bkslot_1"])
    await expect(
      cancelBookingSlot(fakeManager([]).manager, "bkng_1", "bkslot_1", "cash" as never)
    ).rejects.toMatchObject({ safeMessage: "booking.cancel_refund_invalid" })
  })
})

describe("the bell sweep's departures", () => {
  it("reads lately cancelled ones left to staff, or kept before on a cancelled departure", async () => {
    const { manager, calls } = fakeManager([
      [
        {
          use_id: "bkuse_1",
          order_id: "order_1",
          slot_id: "bkslot_1",
          cancel_refund: "offline",
          refund_due: "45000",
          cancelled_at: "2026-11-20T10:00:00Z",
          cancellation: '{"timezone":"Europe/Istanbul","tiers":[]}',
        },
      ],
    ])

    const found = await cancelledUsesByHand(manager, 7, 100)

    expect(found).toEqual([
      {
        use_id: "bkuse_1",
        order_id: "order_1",
        slot_id: "bkslot_1",
        cancel_refund: "offline",
        refund_due: 45000,
        cancelled_at: new Date("2026-11-20T10:00:00Z"),
        cancellation: { timezone: "Europe/Istanbul", tiers: [] },
      },
    ])
    // Settled rows leave the query; the longest waiting come first (review O3 of #277)
    expect(calls[0]?.sql).toContain("u.bell_checked_at IS NULL")
    expect(calls[0]?.sql).toContain("ORDER BY u.updated_at, u.id")
    expect(calls[0]?.sql).toContain("u.updated_at > now() - make_interval(days => ?)")
    expect(calls[0]?.sql).toContain(
      "(u.cancel_refund IN ('offline', 'credit', 'exceeds') OR (u.cancel_refund IS NULL AND s.status = 'cancelled'))"
    )
    expect(calls[0]?.params).toEqual([7, 100])
  })

  it("reads an order's cancelled departures, its whole booking's too", async () => {
    const { manager, calls } = fakeManager([[]])

    expect(await cancelledUsesOfOrder(manager, "order_1")).toEqual([])
    expect(calls[0]?.sql).toContain("(u.cancelled_at IS NOT NULL OR b.status = 'cancelled')")
    expect(calls[0]?.params).toEqual(["order_1"])
  })
})

describe("a cancelled departure owed back by hand", () => {
  it("marks it with its share and puts it back before the sweep, only when nothing was sent", async () => {
    const { manager, calls } = fakeManager([[{ id: "bkuse_1" }]])

    expect(await markUseOwedByHand(manager, "bkuse_1", 45000)).toBe(true)
    expect(calls[0]?.sql).toContain(
      "SET cancel_refund = 'offline', refund_due = ?, bell_checked_at = NULL"
    )
    expect(calls[0]?.sql).toContain("(cancel_refund IS NULL OR cancel_refund = 'none')")
    expect(calls[0]?.params).toEqual([45000, "bkuse_1"])
  })

  it("refuses a share that is not whole kuruş", async () => {
    await expect(markUseOwedByHand(fakeManager([]).manager, "bkuse_1", 1.5)).rejects.toMatchObject({
      safeMessage: "booking.refund_due_invalid",
    })
  })

  it("marks the rows the sweep settled, and writes nothing for none", async () => {
    const { manager, calls } = fakeManager([[{ id: "bkuse_1" }]])

    expect(await markBellsChecked(manager, ["bkuse_1", "bkuse_2"])).toBe(1)
    expect(calls[0]?.sql).toContain("SET bell_checked_at = now()")
    expect(calls[0]?.params).toEqual(["bkuse_1", "bkuse_2"])
    expect(await markBellsChecked(fakeManager([]).manager, [])).toBe(0)
  })
})
