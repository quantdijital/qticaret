import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import { kurus } from "../../../lib/money"
import { BOOKING_MODULE } from "../../../modules/booking"
import type { CancelledUse } from "../../../modules/booking/refund-uses"
import { cashShareOf } from "../cash-share"
import { captureForCancelledDeparture, hasLiveLine, settleCashCapture } from "../paid-guard"

jest.mock("../cash-share", () => ({ cashShareOf: jest.fn() }))

const share = jest.mocked(cashShareOf)

const dated = (slotId: string) => ({
  metadata: {
    qt_booking: { hold_id: "bkhold_1", slot_id: slotId, starts_at: "2026-12-10T09:00:00Z", pax: 1 },
  },
})
const parcel = { metadata: null }

const cancelledUse = (overrides: Partial<CancelledUse> = {}): CancelledUse => ({
  use_id: "bkuse_1",
  order_id: "order_1",
  slot_id: "bkslot_1",
  cancel_refund: "none",
  refund_due: null,
  cancelled_at: new Date("2026-11-20T10:00:00Z"),
  cancellation: null,
  ...overrides,
})

/** A container with the order's cancelled departures, the payment and the order's lines. */
function containerOf(state: {
  cancelled: CancelledUse[]
  payment: Record<string, unknown>
  items: unknown[]
  marked?: boolean
}) {
  const bookings = {
    cancelledUsesOfOrder: jest.fn().mockResolvedValue(state.cancelled),
    markUseOwedByHand: jest.fn().mockResolvedValue(state.marked ?? true),
  }
  const graph = jest.fn((asked: { entity: string }) =>
    Promise.resolve({
      data: asked.entity === "payment" ? [state.payment] : [{ display_id: 7, items: state.items }],
    })
  )
  const notifications = { createNotifications: jest.fn().mockResolvedValue([]) }
  const services: Record<string, unknown> = {
    [BOOKING_MODULE]: bookings,
    [ContainerRegistrationKeys.QUERY]: { graph },
    [Modules.NOTIFICATION]: notifications,
  }
  return {
    container: { resolve: (key: string) => services[key] } as never,
    bookings,
    notifications,
  }
}

const COD = { provider_id: "pp_cod_cod", captured_at: null, captures: [] }

describe("a capture for an order with a cancelled departure (refund safety follow-up)", () => {
  it("goes on with nothing to do when no departure was cancelled", async () => {
    const { container } = containerOf({ cancelled: [], payment: COD, items: [] })

    expect(await captureForCancelledDeparture(container, "order_1", "pay_1")).toEqual([])
  })

  it("lets cash on delivery be recorded for a parcel still to deliver, writing nothing before it", async () => {
    const { container, bookings } = containerOf({
      cancelled: [cancelledUse(), cancelledUse({ use_id: "bkuse_2", cancel_refund: "credit" })],
      payment: COD,
      items: [dated("bkslot_1"), parcel],
    })

    const owed = await captureForCancelledDeparture(container, "order_1", "pay_1")

    // Only a departure nothing was owed for yet; credit has its own bell already
    expect(owed.map((use) => use.use_id)).toEqual(["bkuse_1"])
    expect(bookings.markUseOwedByHand).not.toHaveBeenCalled()
  })

  it("owes nothing more for a payment captured already, in full or in part (review O2 of #277)", async () => {
    for (const payment of [
      { ...COD, captured_at: new Date() },
      { ...COD, captures: [{ id: "capt_1" }] },
    ]) {
      const { container } = containerOf({
        cancelled: [cancelledUse()],
        payment,
        items: [dated("bkslot_1"), parcel],
      })
      expect(await captureForCancelledDeparture(container, "order_1", "pay_1")).toEqual([])
    }
  })

  it("refuses another way to pay, and cash with nothing left to deliver", async () => {
    const transfer = containerOf({
      cancelled: [cancelledUse()],
      payment: { ...COD, provider_id: "pp_bank-transfer_bank-transfer" },
      items: [dated("bkslot_1"), parcel],
    })
    const nothingLeft = containerOf({
      cancelled: [cancelledUse()],
      payment: COD,
      items: [dated("bkslot_1")],
    })

    for (const { container } of [transfer, nothingLeft]) {
      await expect(captureForCancelledDeparture(container, "order_1", "pay_1")).rejects.toEqual(
        expect.objectContaining({ safeMessage: "booking.departure_cancelled_unpaid" })
      )
    }
  })
})

describe("cash on delivery captured: the departure's share owed by hand (review O1, O2 of #277)", () => {
  beforeEach(() => {
    share.mockReset()
  })

  it("marks the share worked out on the server, then rings its bell with it", async () => {
    share.mockResolvedValue(kurus(45000))
    const { container, bookings, notifications } = containerOf({
      cancelled: [],
      payment: COD,
      items: [],
    })

    await settleCashCapture(container, "order_1", [cancelledUse()])

    expect(bookings.markUseOwedByHand).toHaveBeenCalledWith("bkuse_1", 45000)
    const bell = (
      notifications.createNotifications.mock.calls as [
        {
          trigger_type: string
          idempotency_key: string
          data: { amount: string; description: string }
        },
      ][]
    )[0]?.[0]
    expect(bell?.trigger_type).toBe("booking.cash_share_by_hand")
    expect(bell?.idempotency_key).toBe("booking.cash_share_by_hand:order_1:bkslot_1")
    expect(bell?.data.amount).toBe("450.00")
    expect(bell?.data.description).toContain("450.00 TL")
    expect(bell?.data.description).toContain("Kurye siparişin tamamını aldıysa")
  })

  it("rings nothing for a share of nothing, or a row another run marked", async () => {
    share.mockResolvedValue(kurus(0))
    const zero = containerOf({ cancelled: [], payment: COD, items: [] })
    await settleCashCapture(zero.container, "order_1", [cancelledUse()])
    share.mockResolvedValue(kurus(45000))
    const taken = containerOf({ cancelled: [], payment: COD, items: [], marked: false })
    await settleCashCapture(taken.container, "order_1", [cancelledUse()])

    expect(zero.notifications.createNotifications).not.toHaveBeenCalled()
    expect(taken.notifications.createNotifications).not.toHaveBeenCalled()
  })

  it("logs a departure that fails as an error and goes on", async () => {
    const error = jest.spyOn(logger, "error").mockImplementation(() => undefined)
    share.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(kurus(100))
    const { container, bookings } = containerOf({ cancelled: [], payment: COD, items: [] })

    await settleCashCapture(container, "order_1", [
      cancelledUse(),
      cancelledUse({ use_id: "bkuse_2", slot_id: "bkslot_2" }),
    ])

    expect(bookings.markUseOwedByHand).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "booking.cash_share_failed", slot_id: "bkslot_1" })
    )
    error.mockRestore()
  })
})

describe("a line still to deliver", () => {
  it("is a parcel's line or a live departure's", () => {
    const cancelled = new Set(["bkslot_1"])

    expect(hasLiveLine([dated("bkslot_1"), parcel], cancelled)).toBe(true)
    expect(hasLiveLine([dated("bkslot_1"), dated("bkslot_2")], cancelled)).toBe(true)
    expect(hasLiveLine([dated("bkslot_1"), null], cancelled)).toBe(false)
    expect(hasLiveLine([], cancelled)).toBe(false)
  })
})
