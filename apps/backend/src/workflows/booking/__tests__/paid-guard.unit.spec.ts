import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { BOOKING_MODULE } from "../../../modules/booking"
import { captureForCancelledDeparture, hasLiveLine } from "../paid-guard"

const dated = (slotId: string) => ({
  metadata: {
    qt_booking: { hold_id: "bkhold_1", slot_id: slotId, starts_at: "2026-12-10T09:00:00Z", pax: 1 },
  },
})
const parcel = { metadata: null }

/** A container with the order's cancelled departures, the payment's way and the order's lines. */
function containerOf(state: {
  cancelled: { use_id: string; slot_id: string; cancel_refund: string | null }[]
  provider: string
  items: unknown[]
}) {
  const bookings = {
    cancelledUsesOfOrder: jest
      .fn()
      .mockResolvedValue(state.cancelled.map((use) => ({ ...use, order_id: "order_1" }))),
    markUsesOwedByHand: jest.fn().mockResolvedValue(1),
  }
  const services: Record<string, unknown> = {
    [BOOKING_MODULE]: bookings,
    [Modules.PAYMENT]: {
      listPayments: jest.fn().mockResolvedValue([{ provider_id: state.provider }]),
    },
    [ContainerRegistrationKeys.QUERY]: {
      graph: jest.fn().mockResolvedValue({ data: [{ items: state.items }] }),
    },
  }
  return { container: { resolve: (key: string) => services[key] } as never, bookings }
}

const COD = "pp_cod_cod"
const cancelledUse = { use_id: "bkuse_1", slot_id: "bkslot_1", cancel_refund: "none" }

describe("a capture for an order with a cancelled departure (refund safety follow-up)", () => {
  it("goes on with nothing to do when no departure was cancelled", async () => {
    const { container, bookings } = containerOf({ cancelled: [], provider: COD, items: [] })

    expect(await captureForCancelledDeparture(container, "order_1", "pay_1")).toEqual([])
    expect(bookings.markUsesOwedByHand).not.toHaveBeenCalled()
  })

  it("lets cash on delivery be recorded for a parcel still to deliver, the departure owed by hand", async () => {
    const { container, bookings } = containerOf({
      cancelled: [cancelledUse],
      provider: COD,
      items: [dated("bkslot_1"), parcel],
    })

    const owed = await captureForCancelledDeparture(container, "order_1", "pay_1")

    expect(owed.map((use) => use.use_id)).toEqual(["bkuse_1"])
    expect(bookings.markUsesOwedByHand).toHaveBeenCalledWith(["bkuse_1"])
  })

  it("refuses another way to pay, and cash with nothing left to deliver", async () => {
    const card = containerOf({
      cancelled: [cancelledUse],
      provider: "pp_bank-transfer_bank-transfer",
      items: [dated("bkslot_1"), parcel],
    })
    const nothingLeft = containerOf({
      cancelled: [cancelledUse],
      provider: COD,
      items: [dated("bkslot_1")],
    })

    await expect(captureForCancelledDeparture(card.container, "order_1", "pay_1")).rejects.toEqual(
      expect.objectContaining({ safeMessage: "booking.departure_cancelled_unpaid" })
    )
    await expect(
      captureForCancelledDeparture(nothingLeft.container, "order_1", "pay_1")
    ).rejects.toEqual(
      expect.objectContaining({ safeMessage: "booking.departure_cancelled_unpaid" })
    )
    expect(card.bookings.markUsesOwedByHand).not.toHaveBeenCalled()
    expect(nothingLeft.bookings.markUsesOwedByHand).not.toHaveBeenCalled()
  })

  it("leaves a departure whose refund was sent out of the bell", async () => {
    const { container, bookings } = containerOf({
      cancelled: [{ ...cancelledUse, cancel_refund: "sent" }],
      provider: COD,
      items: [parcel],
    })

    expect(await captureForCancelledDeparture(container, "order_1", "pay_1")).toEqual([])
    expect(bookings.markUsesOwedByHand).toHaveBeenCalledWith([])
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
