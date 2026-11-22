import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import { kurus } from "../../../lib/money"
import { BOOKING_MODULE } from "../../../modules/booking"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import { readOrderMoney } from "../../orders/order-money"
import { cancelBookingDeparture } from "../cancel"
import { planBookingCancel } from "../cancel-plan"

jest.mock("../cancel-plan", () => ({
  ...jest.requireActual<Record<string, unknown>>("../cancel-plan"),
  planBookingCancel: jest.fn(),
}))
jest.mock("../../orders/refund-order", () => ({ refundOrderWorkflow: jest.fn() }))
jest.mock("../../orders/order-money", () => ({ readOrderMoney: jest.fn() }))

const planned = jest.mocked(planBookingCancel)
const money = jest.mocked(readOrderMoney)

/** Staff's plan for a departure paid by bank transfer: 900 TL to give back by hand. */
const offlinePlan = {
  order_id: "order_1",
  customer_id: "cus_1",
  order_status: "pending",
  use: { booking_id: "bkng_1", slot_id: "bkslot_1" },
  use_id: "bkuse_1",
  rule: { fee_percent: 0, days_before: null },
  refund: kurus(90000),
  request: { items: [{ id: "ordli_1", quantity: 1 }], fee_percent: 0 },
  manual: "offline",
  unpaid: false,
  dated_only: true,
}

function containerOf(
  options: {
    emit?: jest.Mock
    uses?: { id: string; cancelled_at: Date | null }[]
    payments?: { provider_id: string; captured_at: Date | null }[]
    ledger?: { amount: number; status: string }[]
  } = {}
) {
  const notifications = { createNotifications: jest.fn().mockResolvedValue([]) }
  const emit = options.emit ?? jest.fn().mockResolvedValue(undefined)
  const bookings = {
    cancelBookingSlot: jest.fn().mockResolvedValue(true),
    liveUsesOfOrder: jest.fn().mockResolvedValue([{ slot_id: "bkslot_2" }]),
    listBookings: jest.fn().mockResolvedValue([{ id: "bkng_1" }]),
    listBookingSlotUses: jest.fn().mockResolvedValue(options.uses ?? []),
  }
  const graph = jest.fn().mockResolvedValue({
    data: [
      {
        id: "order_1",
        display_id: 7,
        status: "pending",
        payment_collections: [{ payments: options.payments ?? [] }],
      },
    ],
  })
  const services: Record<string, unknown> = {
    [Modules.LOCKING]: { execute: (_keys: string[], run: () => Promise<unknown>) => run() },
    [Modules.EVENT_BUS]: { emit },
    [Modules.NOTIFICATION]: notifications,
    [ContainerRegistrationKeys.QUERY]: { graph },
    [BOOKING_MODULE]: bookings,
    [ORDER_REFUNDS_MODULE]: {
      listOrderRefunds: jest.fn().mockResolvedValue(options.ledger ?? []),
    },
  }
  return {
    container: { resolve: (key: string) => services[key] } as never,
    notifications,
    emit,
  }
}

const staffCancel = { order_id: "order_1", slot_id: "bkslot_1", mode: "full", by: "staff" } as const

interface Bell {
  trigger_type: string
  idempotency_key?: string
}

const refundBells = (notifications: { createNotifications: jest.Mock }): Bell[] =>
  (notifications.createNotifications.mock.calls as [Bell][])
    .map(([entry]) => entry)
    .filter((entry) => entry.trigger_type === "booking.refund_by_hand")

beforeEach(() => {
  planned.mockReset()
  money.mockReset()
  money.mockResolvedValue({ credit: kurus(0) } as never)
})

describe("a departure's refund left to staff, rung whatever follows (D7a security review)", () => {
  it("rings the bell once per departure before the event, and keeps the cancel when the event fails", async () => {
    planned.mockResolvedValue(offlinePlan as never)
    const error = jest.spyOn(logger, "error").mockImplementation(() => undefined)
    const { container, notifications } = containerOf({
      emit: jest.fn().mockRejectedValue(new Error("redis down")),
    })

    const result = await cancelBookingDeparture(container, staffCancel)

    expect(result).toEqual(
      expect.objectContaining({ cancelled: true, refund_by_hand: 90000, manual: "offline" })
    )
    expect(refundBells(notifications)).toHaveLength(1)
    expect(refundBells(notifications)[0]).toEqual(
      expect.objectContaining({ idempotency_key: "booking.refund_by_hand:order_1:bkslot_1" })
    )
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "booking.cancelled_event_failed", order_id: "order_1" })
    )
    error.mockRestore()
  })

  it("rings it again on staff's retry once the places went back with no refund made", async () => {
    planned.mockResolvedValue(null)
    const { container, notifications } = containerOf({
      uses: [{ id: "bkuse_1", cancelled_at: new Date() }],
      payments: [{ provider_id: "pp_bank-transfer_bank-transfer", captured_at: new Date() }],
    })

    const result = await cancelBookingDeparture(container, staffCancel)

    expect(result).toEqual(expect.objectContaining({ cancelled: false, manual: null }))
    expect(refundBells(notifications)[0]).toEqual(
      expect.objectContaining({ idempotency_key: "booking.refund_by_hand:order_1:bkslot_1" })
    )
  })

  it("rings it again for credit used, and never for a card refund made or the shopper's retry", async () => {
    planned.mockResolvedValue(null)
    const cancelled = [{ id: "bkuse_1", cancelled_at: new Date() }]
    const card = [{ provider_id: "pp_paytr_paytr", captured_at: new Date() }]

    money.mockResolvedValue({ credit: kurus(40000) } as never)
    const credit = containerOf({ uses: cancelled, payments: card })
    await cancelBookingDeparture(credit.container, staffCancel)
    expect(refundBells(credit.notifications)).toHaveLength(1)

    const refunded = containerOf({
      uses: cancelled,
      payments: card,
      ledger: [{ amount: 90000, status: "done" }],
    })
    const done = await cancelBookingDeparture(refunded.container, staffCancel)
    expect(done.refunded).toBe(90000)
    expect(refundBells(refunded.notifications)).toHaveLength(0)

    const shopper = containerOf({
      uses: cancelled,
      payments: [{ provider_id: "pp_cod_cod", captured_at: new Date() }],
    })
    await cancelBookingDeparture(shopper.container, {
      ...staffCancel,
      mode: "tier",
      by: "customer",
      customer_id: "cus_1",
    })
    expect(refundBells(shopper.notifications)).toHaveLength(0)

    money.mockResolvedValue({ credit: kurus(0) } as never)
    const plainCard = containerOf({ uses: cancelled, payments: card })
    await cancelBookingDeparture(plainCard.container, staffCancel)
    expect(refundBells(plainCard.notifications)).toHaveLength(0)
  })
})
