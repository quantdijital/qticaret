import { Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { kurus } from "../../../lib/money"
import { BOOKING_MODULE } from "../../../modules/booking"
import { cancelBookingDeparture } from "../cancel"
import { planBookingCancel } from "../cancel-plan"
import { alertDepartureRefundGivenUp } from "../confirm-alert"
import {
  DEPARTURE_CANCELLED,
  previewDepartureCancel,
  processDepartureCancel,
  resumeDepartureCancels,
  startDepartureCancel,
} from "../departure-cancel"
import { createMemoryReconcileAttempts } from "../reconcile-attempts"

jest.mock("../cancel", () => ({ cancelBookingDeparture: jest.fn() }))
jest.mock("../cancel-plan", () => ({ planBookingCancel: jest.fn() }))
jest.mock("../confirm-alert", () => ({ alertDepartureRefundGivenUp: jest.fn() }))
const mockAttempts = { current: createMemoryReconcileAttempts() }
jest.mock("../reconcile-attempts", () => ({
  ...jest.requireActual<object>("../reconcile-attempts"),
  reconcileAttempts: () => mockAttempts.current,
}))

const plan = jest.mocked(planBookingCancel)
const cancel = jest.mocked(cancelBookingDeparture)
const alert = jest.mocked(alertDepartureRefundGivenUp)

const use = (orderId: string, units = 1) => ({
  use_id: `bkuse_${orderId}`,
  booking_id: `bkng_${orderId}`,
  order_id: orderId,
  slot_id: "bkslot_1",
  units,
  cancellation: null,
})

/** A container with the booking service, the event bus and the lock, each recording. */
function containerWith(state: {
  uses: ReturnType<typeof use>[]
  status?: string
  slots?: string[]
}) {
  const events: string[] = []
  const order: string[] = []
  const bookings = {
    listBookingSlots: jest.fn(() =>
      Promise.resolve([{ id: "bkslot_1", status: state.status ?? "cancelled" }])
    ),
    liveUsesOnSlot: jest.fn((asked: string, limit: number) => {
      order.push("read")
      return Promise.resolve(state.uses.slice(0, limit).map((row) => ({ ...row, slot_id: asked })))
    }),
    updateSlot: jest.fn(() => {
      order.push("cancel")
      state.status = "cancelled"
      return Promise.resolve(true)
    }),
    cancelledSlotsWithLiveUses: jest.fn(() => Promise.resolve(state.slots ?? [])),
  }
  const container = {
    resolve: (key: string) => {
      if (key === BOOKING_MODULE) {
        return bookings
      }
      if (key === Modules.EVENT_BUS) {
        return {
          emit: (event: { name: string }) => {
            order.push("emit")
            events.push(event.name)
            return Promise.resolve()
          },
        }
      }
      if (key === Modules.LOCKING) {
        return { execute: (_key: string, job: () => Promise<unknown>) => job() }
      }
      throw new Error(`unexpected ${key}`)
    },
  } as unknown as MedusaContainer
  return { container, events, order, bookings }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAttempts.current = createMemoryReconcileAttempts()
})

describe("the departure cancel's preview (review D3, O2)", () => {
  it("sums what is sent apart from what staff give back by hand", async () => {
    const { container } = containerWith({ uses: [use("o1"), use("o2"), use("o3", 2)] })
    plan
      .mockResolvedValueOnce({ refund: kurus(90000), manual: null } as never)
      .mockResolvedValueOnce({ refund: kurus(50000), manual: "offline" } as never)
      .mockResolvedValueOnce({ refund: kurus(30000), manual: "credit" } as never)

    expect(await previewDepartureCancel(container, "bkslot_1")).toEqual({
      slot_id: "bkslot_1",
      status: "cancelled",
      bookings: 3,
      orders: 3,
      units: 4,
      refund: "900.00",
      refund_by_hand: "800.00",
      by_hand_orders: 2,
      partial: false,
    })
  })

  it("leaves an order it cannot read out of the sums and says the preview is partial", async () => {
    const { container } = containerWith({ uses: [use("o1"), use("o2")] })
    plan
      .mockRejectedValueOnce(new Error("orders.refund_exceeds_paid"))
      .mockResolvedValueOnce({ refund: kurus(90000), manual: null } as never)

    const preview = await previewDepartureCancel(container, "bkslot_1")

    expect([preview.refund, preview.partial, preview.bookings]).toEqual(["900.00", true, 2])
  })

  it("cancels the slot, starts the work and answers with the counts only, no plan read", async () => {
    const { container, events, order } = containerWith({
      uses: [use("o1"), use("o2", 3)],
      status: "open",
    })

    const answer = await startDepartureCancel(container, "bkslot_1")

    expect(answer).toEqual({
      slot_id: "bkslot_1",
      status: "cancelled",
      bookings: 2,
      orders: 2,
      units: 4,
    })
    expect(plan).not.toHaveBeenCalled()
    expect(events).toEqual([DEPARTURE_CANCELLED])
    expect(order).toEqual(["cancel", "read", "emit"])
  })
})

describe("the departure cancel's work (review O4)", () => {
  it("rings the bell once an order's refund failed every try of the day", async () => {
    const state = { uses: [use("o1")] }
    const { container } = containerWith(state)
    cancel.mockRejectedValue(new Error("provider down"))

    await processDepartureCancel(container, "bkslot_1")
    await processDepartureCancel(container, "bkslot_1")
    expect(alert).not.toHaveBeenCalled()
    await processDepartureCancel(container, "bkslot_1")
    const after = await processDepartureCancel(container, "bkslot_1")

    expect(alert).toHaveBeenCalledTimes(1)
    expect(alert).toHaveBeenCalledWith(container, "o1", "bkslot_1")
    expect(after).toEqual({ cancelled: 0, failed: 0, skipped: 1 })
  })

  it("passes over slots it has given up on and works on the next ones (review D4)", async () => {
    const state = { uses: [use("o1")], slots: ["bkslot_1", "bkslot_2"] }
    const { container } = containerWith(state)
    for (let i = 0; i < 3; i++) {
      await mockAttempts.current.fail("departure:bkslot_1:o1")
    }
    cancel.mockResolvedValue({} as never)

    const run = await resumeDepartureCancels(container)

    // bkslot_1's only booking is given up; the sweep still reaches bkslot_2
    expect(run.skipped).toBe(1)
    expect(cancel).toHaveBeenCalledTimes(1)
  })
})
