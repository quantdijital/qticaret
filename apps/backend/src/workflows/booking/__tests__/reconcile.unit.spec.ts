import type { MedusaContainer } from "@medusajs/framework/types"
import bookingReconcile, { config } from "../../../jobs/booking-reconcile"
import {
  CANCELLED_WITH_BOOKINGS,
  RECONCILE_LOOKBACK_HOURS,
  RECONCILE_PAGE,
  RECONCILE_SETTLE_MINUTES,
  UNCONFIRMED_ORDERS,
  reconcileBookings,
} from "../reconcile"

function containerWith(unconfirmed: string[], cancelled: string[]) {
  const raw = jest.fn((sql: string) =>
    Promise.resolve({
      rows:
        sql === UNCONFIRMED_ORDERS
          ? unconfirmed.map((id) => ({ id }))
          : cancelled.map((order_id) => ({ order_id })),
    })
  )
  const container = { resolve: () => ({ raw }) } as unknown as MedusaContainer
  return { container, raw }
}

describe("booking reconcile (adr/0076 Ek takip L2)", () => {
  it("runs every ten minutes", () => {
    expect(config).toEqual({ name: "booking-reconcile", schedule: "*/10 * * * *" })
  })

  it("confirms placed orders without a booking and cancels a cancelled order's bookings", async () => {
    const { container, raw } = containerWith(["order_a", "order_b"], ["order_c"])
    const confirm = jest.fn(() => Promise.resolve("confirmed"))
    const cancel = jest.fn(() => Promise.resolve(1))

    const counts = await reconcileBookings(container, { confirm, cancel })

    expect(counts).toEqual({ confirmed: 2, cancelled: 1, failed: 0 })
    expect(confirm.mock.calls).toEqual([["order_a"], ["order_b"]])
    expect(cancel.mock.calls).toEqual([["order_c"]])
    // Every value bound: the look-back, the settle time, the line's mark, a page at most
    expect(raw).toHaveBeenCalledWith(UNCONFIRMED_ORDERS, [
      RECONCILE_LOOKBACK_HOURS,
      RECONCILE_SETTLE_MINUTES,
      "qt_booking",
      RECONCILE_PAGE,
    ])
    expect(raw).toHaveBeenCalledWith(CANCELLED_WITH_BOOKINGS, [RECONCILE_PAGE])
  })

  it("counts one order's failure and goes on with the rest", async () => {
    const { container } = containerWith(["order_busy", "order_ok"], ["order_x"])
    const confirm = jest.fn((orderId: string) =>
      orderId === "order_busy" ? Promise.reject(new Error("lock timeout")) : Promise.resolve()
    )
    const cancel = jest.fn(() => Promise.reject(new Error("db down")))
    const onError = jest.fn<undefined, [string, string, unknown]>()

    const counts = await reconcileBookings(container, { confirm, cancel, onError })

    expect(counts).toEqual({ confirmed: 1, cancelled: 0, failed: 2 })
    expect(onError.mock.calls.map(([side, orderId]): string[] => [side, orderId])).toEqual([
      ["confirm", "order_busy"],
      ["cancel", "order_x"],
    ])
  })

  it("leaves cancelled, draft, fresh, booked and already alerted orders out of the confirm side", () => {
    expect(UNCONFIRMED_ORDERS).toContain("o.canceled_at IS NULL")
    expect(UNCONFIRMED_ORDERS).toContain("o.is_draft_order = false")
    expect(UNCONFIRMED_ORDERS).toContain("FROM booking b WHERE b.order_id = o.id")
    expect(UNCONFIRMED_ORDERS).toContain("n.trigger_type = 'booking.confirm_failed'")
    expect(UNCONFIRMED_ORDERS).toContain("LIMIT ?")
    expect(CANCELLED_WITH_BOOKINGS).toContain("b.status = 'confirmed'")
    expect(CANCELLED_WITH_BOOKINGS).toContain("LIMIT ?")
  })

  it("never throws out of the job: a failed read is logged and the next run tries again", async () => {
    const container = {
      resolve: () => ({ raw: () => Promise.reject(new Error("connection refused")) }),
    } as unknown as MedusaContainer

    await expect(bookingReconcile(container)).resolves.toBeUndefined()
  })
})
