import type { MedusaContainer } from "@medusajs/framework/types"
import { sendMessageWorkflow } from "../../messaging/send-message"
import {
  cancelTemplateOf,
  confirmsBooking,
  sendBookingCancelled,
  sendBookingConfirmations,
} from "../messages"

jest.mock("../../messaging/send-message", () => ({ sendMessageWorkflow: jest.fn() }))

const run = jest.fn()
;(sendMessageWorkflow as unknown as jest.Mock).mockImplementation(() => ({ run }))

function containerWith(service: Record<string, jest.Mock>) {
  return { resolve: () => service } as unknown as MedusaContainer
}

const EVENT = {
  order_id: "order_1",
  booking_id: "bkng_1",
  slot_id: "bkslot_1",
  by: "customer" as const,
  refund_by_hand: false,
}

describe("a booking's e-mails where its life moves (adr/0076 Ek D7b)", () => {
  beforeEach(() => {
    run.mockReset()
  })

  it("tells the shop's whole departure apart from one booking's cancel", () => {
    expect(cancelTemplateOf("shop")).toBe("booking.departure_cancelled")
    expect(cancelTemplateOf("customer")).toBe("booking.cancelled")
    expect(cancelTemplateOf("staff")).toBe("booking.cancelled")
  })

  it("confirms only an outcome that leaves a booking", () => {
    expect(["confirmed", "retaken", "existing"].every(confirmsBooking)).toBe(true)
    expect(["none", "failed", "canceled"].some(confirmsBooking)).toBe(false)
  })

  it("sends each confirmed booking's confirmation under the booking", async () => {
    const listBookings = jest.fn(() => Promise.resolve([{ id: "bkng_1" }, { id: "bkng_2" }]))
    run.mockResolvedValue({ result: {} })
    await sendBookingConfirmations(containerWith({ listBookings }), "order_1")
    expect(listBookings).toHaveBeenCalledWith(
      { order_id: "order_1", status: "confirmed" },
      { select: ["id"] }
    )
    expect(run.mock.calls.map(([call]) => (call as { input: unknown }).input)).toEqual([
      { template: "booking.confirmed", resource_id: "bkng_1" },
      { template: "booking.confirmed", resource_id: "bkng_2" },
    ])
  })

  it("sends a cancel under the departure's use row, with whether staff refund by hand", async () => {
    const listBookingSlotUses = jest.fn(() => Promise.resolve([{ id: "bkuse_1" }]))
    run.mockResolvedValue({ result: {} })
    await sendBookingCancelled(containerWith({ listBookingSlotUses }), {
      ...EVENT,
      by: "shop",
      refund_by_hand: true,
    })
    expect(run).toHaveBeenCalledWith({
      input: {
        template: "booking.departure_cancelled",
        resource_id: "bkuse_1",
        extra: { by_hand: "1" },
      },
    })
  })

  it("never throws: a failed send leaves the cancel and the booking as they are", async () => {
    const listBookingSlotUses = jest.fn(() => Promise.resolve([{ id: "bkuse_1" }]))
    run.mockRejectedValue(new Error("smtp down"))
    await expect(
      sendBookingCancelled(containerWith({ listBookingSlotUses }), EVENT)
    ).resolves.toBeUndefined()
    const listBookings = jest.fn(() => Promise.reject(new Error("db down")))
    await expect(
      sendBookingConfirmations(containerWith({ listBookings }), "order_1")
    ).resolves.toBeUndefined()
  })
})
