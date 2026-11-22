import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import { kurus } from "../../../lib/money"
import { BOOKING_MODULE } from "../../../modules/booking"
import type { CancelledUse } from "../../../modules/booking/refund-uses"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import { readOrderMoney } from "../../orders/order-money"
import { ringLostRefundBells } from "../refund-bells"

jest.mock("../../orders/order-money", () => ({ readOrderMoney: jest.fn() }))

const money = jest.mocked(readOrderMoney)

const use = (
  order: string,
  cancelRefund: string | null,
  due: number | null = null
): CancelledUse => ({
  use_id: `bkuse_${order}`,
  order_id: order,
  slot_id: "bkslot_1",
  cancel_refund: cancelRefund,
  refund_due: due,
  cancelled_at: new Date("2026-11-20T10:00:00Z"),
  cancellation: null,
})

/** A container answering the sweep: its uses, the bells written, the ledger, the payments. */
function containerOf(state: {
  uses: CancelledUse[]
  rung?: string[]
  refunded?: string[]
  payments?: { provider_id: string; captured_at: Date | null }[]
  bellFails?: boolean
}) {
  const notifications = {
    listNotifications: jest.fn((filter: { idempotency_key: string[] }) =>
      Promise.resolve(
        filter.idempotency_key
          .filter((key) => (state.rung ?? []).includes(key))
          .map((key) => ({ idempotency_key: key }))
      )
    ),
    createNotifications: state.bellFails
      ? jest.fn().mockRejectedValue(new Error("db down"))
      : jest.fn().mockResolvedValue([]),
  }
  const ledger = {
    listOrderRefunds: jest.fn((filter: { reference: string }) =>
      Promise.resolve(
        (state.refunded ?? []).some((id) => filter.reference.includes(id.replace(/_/g, "")))
          ? [{ amount: 90000, status: "done" }]
          : []
      )
    ),
  }
  const bookings = {
    cancelledUsesByHand: jest.fn().mockResolvedValue(state.uses),
    markBellsChecked: jest.fn().mockResolvedValue(0),
  }
  const services: Record<string, unknown> = {
    [Modules.NOTIFICATION]: notifications,
    [BOOKING_MODULE]: bookings,
    [ORDER_REFUNDS_MODULE]: ledger,
    [ContainerRegistrationKeys.QUERY]: {
      graph: jest.fn().mockResolvedValue({
        data: [{ display_id: 7, payment_collections: [{ payments: state.payments ?? [] }] }],
      }),
    },
  }
  return {
    container: { resolve: (key: string) => services[key] } as never,
    notifications,
    bookings,
  }
}

const bellsOf = (notifications: { createNotifications: jest.Mock }) =>
  (notifications.createNotifications.mock.calls as [{ idempotency_key?: string }][]).map(
    ([entry]) => entry.idempotency_key
  )

beforeEach(() => {
  money.mockReset()
  money.mockResolvedValue({ paid: kurus(90000), credit: kurus(0) } as never)
})

describe("a cancelled departure's refund bell caught up (refund safety follow-up)", () => {
  it("rings the bell a cancel left to staff and never rang, then settles the row", async () => {
    const { container, notifications, bookings } = containerOf({
      uses: [use("order_1", "offline")],
    })

    const sweep = await ringLostRefundBells(container)

    expect(sweep).toEqual({ rung: 1, failed: 0 })
    expect(bellsOf(notifications)).toEqual(["booking.refund_by_hand:order_1:bkslot_1"])
    expect(bookings.markBellsChecked).toHaveBeenCalledWith(["bkuse_order_1"])
  })

  it("rings a cash on delivery share's own bell, with the share kept on the row", async () => {
    const { container, notifications } = containerOf({ uses: [use("order_1", "offline", 45000)] })

    await ringLostRefundBells(container)

    const entry = (
      notifications.createNotifications.mock.calls as [
        { idempotency_key: string; data: { amount: string } },
      ][]
    )[0]?.[0]
    expect(entry?.idempotency_key).toBe("booking.cash_share_by_hand:order_1:bkslot_1")
    expect(entry?.data.amount).toBe("450.00")
  })

  it("settles without ringing a bell rung before, a refund in the ledger, nothing taken, a zero share", async () => {
    const rung = containerOf({
      uses: [use("order_1", "credit")],
      rung: ["booking.refund_by_hand:order_1:bkslot_1"],
    })
    const refunded = containerOf({ uses: [use("order_2", "exceeds")], refunded: ["order_2"] })
    const zero = containerOf({ uses: [use("order_4", "offline", 0)] })

    expect(await ringLostRefundBells(rung.container)).toEqual({ rung: 0, failed: 0 })
    expect(await ringLostRefundBells(refunded.container)).toEqual({ rung: 0, failed: 0 })
    expect(await ringLostRefundBells(zero.container)).toEqual({ rung: 0, failed: 0 })
    money.mockResolvedValue({ paid: kurus(0), credit: kurus(0) } as never)
    const unpaid = containerOf({ uses: [use("order_3", "offline")] })
    expect(await ringLostRefundBells(unpaid.container)).toEqual({ rung: 0, failed: 0 })
    expect(bellsOf(rung.notifications)).toEqual([])
    expect(bellsOf(unpaid.notifications)).toEqual([])
    expect(unpaid.bookings.markBellsChecked).toHaveBeenCalledWith(["bkuse_order_3"])
    expect(zero.bookings.markBellsChecked).toHaveBeenCalledWith(["bkuse_order_4"])
  })

  it("guesses from the order for a departure cancelled before the way was kept", async () => {
    const transfer = containerOf({
      uses: [use("order_1", null)],
      payments: [{ provider_id: "pp_bank-transfer_bank-transfer", captured_at: new Date() }],
    })
    const card = containerOf({
      uses: [use("order_2", null)],
      payments: [{ provider_id: "pp_paytr_paytr", captured_at: new Date() }],
    })

    expect((await ringLostRefundBells(transfer.container)).rung).toBe(1)
    expect((await ringLostRefundBells(card.container)).rung).toBe(0)
  })

  it("keeps a row whose bell could not be written for the next run", async () => {
    const error = jest.spyOn(logger, "error").mockImplementation(() => undefined)
    const { container, bookings } = containerOf({
      uses: [use("order_1", "offline")],
      bellFails: true,
    })

    expect(await ringLostRefundBells(container)).toEqual({ rung: 0, failed: 1 })
    expect(bookings.markBellsChecked).toHaveBeenCalledWith([])
    error.mockRestore()
  })

  it("logs one order's failure as an error and goes on", async () => {
    const error = jest.spyOn(logger, "error").mockImplementation(() => undefined)
    money.mockRejectedValueOnce(new Error("db down"))
    const { container, notifications, bookings } = containerOf({
      uses: [use("order_1", "offline"), use("order_2", "offline")],
    })

    const sweep = await ringLostRefundBells(container)

    expect(sweep).toEqual({ rung: 1, failed: 1 })
    expect(bellsOf(notifications)).toEqual(["booking.refund_by_hand:order_2:bkslot_1"])
    expect(bookings.markBellsChecked).toHaveBeenCalledWith(["bkuse_order_2"])
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "booking.refund_bell_sweep_failed", order_id: "order_1" })
    )
    error.mockRestore()
  })
})
