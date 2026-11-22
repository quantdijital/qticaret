import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../../../lib/logging"
import { RECONCILE_PAGE, RECONCILE_SETTLE_MINUTES } from "../reconcile"
import { RECONCILE_MAX_ATTEMPTS, createMemoryReconcileAttempts } from "../reconcile-attempts"
import { UNATTACHED_TRAVELERS, reconcileTravelers } from "../reconcile-travelers"

function containerWith(orderIds: string[]) {
  const raw = jest.fn(() => Promise.resolve({ rows: orderIds.map((order_id) => ({ order_id })) }))
  const container = { resolve: () => ({ raw }) } as unknown as MedusaContainer
  return { container, raw }
}

describe("travelers that missed their booking (adr/0076 §7, review O1)", () => {
  let warn: jest.SpyInstance
  beforeEach(() => {
    warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)
  })
  afterEach(() => {
    warn.mockRestore()
  })

  it("attaches each found order's travelers, binding every value", async () => {
    const { container, raw } = containerWith(["order_a", "order_b"])
    const attach = jest.fn(() => Promise.resolve(1))
    const alert = jest.fn(() => Promise.resolve())

    const counts = await reconcileTravelers(
      container,
      { attach, alert },
      createMemoryReconcileAttempts()
    )

    expect(counts).toEqual({ attached: 2, failed: 0, given_up: 0 })
    expect(attach.mock.calls).toEqual([["order_a"], ["order_b"]])
    expect(raw).toHaveBeenCalledWith(UNATTACHED_TRAVELERS, [
      RECONCILE_SETTLE_MINUTES,
      RECONCILE_PAGE,
    ])
    expect(alert).not.toHaveBeenCalled()
  })

  it("rings the bell once, on the last failed try, then leaves the order alone", async () => {
    const { container } = containerWith(["order_stuck"])
    const attach = jest.fn(() => Promise.reject(new Error("lock timeout")))
    const alert = jest.fn(() => Promise.resolve())
    const attempts = createMemoryReconcileAttempts()
    const runs = []

    for (let run = 0; run < RECONCILE_MAX_ATTEMPTS + 1; run += 1) {
      runs.push(await reconcileTravelers(container, { attach, alert }, attempts))
    }

    expect(attach).toHaveBeenCalledTimes(RECONCILE_MAX_ATTEMPTS)
    expect(alert.mock.calls).toEqual([["order_stuck"]])
    expect(runs.at(-1)).toEqual({ attached: 0, failed: 0, given_up: 1 })
    // Ids only in the log
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "booking.travelers_reattach_failed",
        order_id: "order_stuck",
      })
    )
  })

  it("keeps its tries apart from the order's confirm tries and forgets them on success", async () => {
    const { container } = containerWith(["order_late"])
    const attempts = createMemoryReconcileAttempts()
    await attempts.fail("order_late")
    await attempts.fail("travelers:order_late")

    await reconcileTravelers(
      container,
      { attach: () => Promise.resolve(1), alert: () => Promise.resolve() },
      attempts
    )

    expect(await attempts.count("travelers:order_late")).toBe(0)
    expect(await attempts.count("order_late")).toBe(1)
  })

  it("looks only at settled bookings with unattached travelers and no bell yet", () => {
    expect(UNATTACHED_TRAVELERS).toContain("t.booking_id IS NULL")
    expect(UNATTACHED_TRAVELERS).toContain("JOIN order_cart oc ON oc.order_id = b.order_id")
    expect(UNATTACHED_TRAVELERS).toContain("n.trigger_type = 'booking.travelers_attach_failed'")
    expect(UNATTACHED_TRAVELERS).toContain("make_interval(mins => ?)")
    expect(UNATTACHED_TRAVELERS).toContain("LIMIT ?")
  })
})
