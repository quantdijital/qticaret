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
import {
  RECONCILE_ATTEMPTS_TTL_HOURS,
  RECONCILE_MAX_ATTEMPTS,
  createMemoryReconcileAttempts,
} from "../reconcile-attempts"
import type { ConfirmOutcome } from "../orders"

const fresh = () => createMemoryReconcileAttempts()
const none = { confirmed: 0, existing: 0, none: 0, cancelled: 0, failed: 0, given_up: 0 }

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
    const confirm = jest.fn<Promise<ConfirmOutcome>, [string, boolean]>(() =>
      Promise.resolve("confirmed" as const)
    )
    const cancel = jest.fn(() => Promise.resolve(1))

    const counts = await reconcileBookings(container, { confirm, cancel }, fresh())

    expect(counts).toEqual({ ...none, confirmed: 2, cancelled: 1 })
    expect(confirm.mock.calls).toEqual([
      ["order_a", false],
      ["order_b", false],
    ])
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
      orderId === "order_busy"
        ? Promise.reject(new Error("lock timeout"))
        : Promise.resolve("confirmed" as const)
    )
    const cancel = jest.fn(() => Promise.reject(new Error("db down")))
    const onError = jest.fn<undefined, [string, string, unknown]>()

    const counts = await reconcileBookings(container, { confirm, cancel, onError }, fresh())

    expect(counts).toEqual({ ...none, confirmed: 1, failed: 2 })
    expect(onError.mock.calls.map(([side, orderId]): string[] => [side, orderId])).toEqual([
      ["confirm", "order_busy"],
      ["cancel", "order_x"],
    ])
  })

  it("counts only the bookings it wrote as confirmed; found, nothing and failed apart", async () => {
    const outcomes = {
      o1: "confirmed",
      o2: "retaken",
      o3: "existing",
      o4: "none",
      o5: "canceled",
      o6: "failed",
    } as const
    const { container } = containerWith(Object.keys(outcomes), [])
    const confirm = jest.fn((orderId: string) =>
      Promise.resolve(outcomes[orderId as keyof typeof outcomes])
    )

    const counts = await reconcileBookings(container, { confirm, cancel: jest.fn() }, fresh())

    expect(counts).toEqual({ ...none, confirmed: 2, existing: 1, none: 2, failed: 1 })
  })

  it("tries an order that keeps failing a few times, then leaves it alone for a day", async () => {
    const { container } = containerWith(["order_stuck"], [])
    const confirm = jest.fn<Promise<ConfirmOutcome>, [string, boolean]>(() =>
      Promise.reject(new Error("lock timeout"))
    )
    const onError = jest.fn()
    let now = Date.parse("2026-11-22T10:00:00Z")
    const attempts = createMemoryReconcileAttempts(() => now)
    const runs = []

    for (let run = 0; run < RECONCILE_MAX_ATTEMPTS + 2; run += 1) {
      runs.push(
        await reconcileBookings(container, { confirm, cancel: jest.fn(), onError }, attempts)
      )
    }

    expect(RECONCILE_MAX_ATTEMPTS).toBe(3)
    expect(confirm).toHaveBeenCalledTimes(RECONCILE_MAX_ATTEMPTS)
    // Only the first and the last try are loud
    expect(confirm.mock.calls.map(([, quiet]) => quiet)).toEqual([false, true, false])
    expect(onError).toHaveBeenCalledTimes(2)
    expect(runs.map((counts) => [counts.failed, counts.given_up])).toEqual([
      [1, 0],
      [1, 0],
      [1, 0],
      [0, 1],
      [0, 1],
    ])
    // A day later it is tried again
    now += RECONCILE_ATTEMPTS_TTL_HOURS * 60 * 60 * 1000 + 1
    await reconcileBookings(container, { confirm, cancel: jest.fn(), onError }, attempts)
    expect(confirm).toHaveBeenCalledTimes(RECONCILE_MAX_ATTEMPTS + 1)
  })

  it("forgets an order's failures once it goes through", async () => {
    const { container } = containerWith(["order_late"], [])
    const attempts = fresh()
    await attempts.fail("order_late")
    const confirm = jest.fn(() => Promise.resolve("confirmed" as const))

    await reconcileBookings(container, { confirm, cancel: jest.fn() }, attempts)

    expect(await attempts.count("order_late")).toBe(0)
  })

  it("looks at the newest orders first on both sides", () => {
    expect(UNCONFIRMED_ORDERS).toContain("ORDER BY o.created_at DESC, o.id DESC")
    expect(CANCELLED_WITH_BOOKINGS).toContain("ORDER BY first DESC, b.order_id DESC")
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
