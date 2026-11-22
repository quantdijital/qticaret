import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { BOOKING_KEY } from "../../../lib/booking/cart-lines"
import { logger } from "../../../lib/logging"
import { BOOKING_MODULE } from "../../../modules/booking"
import { refuseBookingEdits } from "../order-edit"
import { confirmOrderBookings, unitsOfLine } from "../orders"

const mark = { hold_id: "bkhold_1", slot_id: "bkslot_1", starts_at: "2026-12-01T09:00:00Z", pax: 1 }
const datedLine = { id: "ordli_1", quantity: 2, metadata: { [BOOKING_KEY]: mark } }

function containerOf(
  rows: Record<string, unknown[]>,
  bookings: Record<string, jest.Mock> = {},
  notifications = { createNotifications: jest.fn().mockResolvedValue([]) }
) {
  const graph = jest.fn(({ entity }: { entity: string }) =>
    Promise.resolve({ data: rows[entity] ?? [] })
  )
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.QUERY]: { graph },
    [BOOKING_MODULE]: bookings,
    [Modules.NOTIFICATION]: notifications,
  }
  return { container: { resolve: (key: string) => services[key] } as never, graph, notifications }
}

const bookingService = (overrides: Record<string, jest.Mock> = {}) => ({
  listBookings: jest.fn().mockResolvedValue([]),
  releaseHold: jest.fn().mockResolvedValue(true),
  confirmHold: jest.fn().mockResolvedValue({ booking_id: "bkng_1", created: true }),
  attachTravelers: jest.fn().mockResolvedValue(0),
  holdUnits: jest.fn(),
  ...overrides,
})

describe("a dated order's places (adr/0076 Ek, review D1, O4)", () => {
  it("does not confirm a cancelled order's places: its hold goes back", async () => {
    const bookings = bookingService()
    const { container } = containerOf(
      { order: [{ id: "order_1", status: "canceled", items: [datedLine] }] },
      bookings
    )

    expect(await confirmOrderBookings(container, "order_1")).toBe("canceled")
    expect(bookings.releaseHold).toHaveBeenCalledWith("bkhold_1")
    expect(bookings.confirmHold).not.toHaveBeenCalled()
  })

  it("leaves a cancelled order's booking to its cancel when it was confirmed first", async () => {
    const bookings = bookingService({ listBookings: jest.fn().mockResolvedValue([{ id: "bk_1" }]) })
    const { container } = containerOf(
      { order: [{ id: "order_1", status: "canceled", items: [datedLine] }] },
      bookings
    )

    expect(await confirmOrderBookings(container, "order_1")).toBe("existing")
    expect(bookings.releaseHold).not.toHaveBeenCalled()
  })

  it("rings the panel's bell when no place is left for a placed order", async () => {
    const bookings = bookingService({
      confirmHold: jest.fn().mockRejectedValue({ safeMessage: "booking.hold_missing" }),
      holdUnits: jest.fn().mockRejectedValue({ safeMessage: "booking.slot_full" }),
    })
    const { container, notifications } = containerOf(
      { order: [{ id: "order_1", status: "pending", display_id: 42, items: [datedLine] }] },
      bookings
    )

    expect(await confirmOrderBookings(container, "order_1")).toBe("failed")
    expect(notifications.createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "feed",
        trigger_type: "booking.confirm_failed",
        resource_id: "order_1",
        data: expect.objectContaining({ order_id: "order_1", display_id: "42" }) as unknown,
      })
    )
  })

  it("takes the places again by the line's units from its detail (D7a security review)", async () => {
    const bookings = bookingService({
      confirmHold: jest
        .fn()
        .mockRejectedValueOnce({ safeMessage: "booking.hold_missing" })
        .mockResolvedValue({ booking_id: "bkng_2", created: true }),
      holdUnits: jest.fn().mockResolvedValue({ hold_id: "bkhold_order" }),
    })
    // As Medusa answers: the line's units only under `detail` once asked for
    const line = { id: "ordli_1", detail: { quantity: 3 }, metadata: datedLine.metadata }
    const { container, graph } = containerOf(
      { order: [{ id: "order_1", status: "pending", items: [line] }] },
      bookings
    )
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)

    expect(await confirmOrderBookings(container, "order_1")).toBe("retaken")
    expect(bookings.holdUnits).toHaveBeenCalledWith(
      "order:order_1",
      [{ slotId: "bkslot_1", units: 3 }],
      10
    )
    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.arrayContaining(["items.detail.quantity"]) as unknown,
      })
    )
    warn.mockRestore()
  })

  it("counts a line with no units read as none, never NaN", () => {
    expect(unitsOfLine({ id: "l", detail: { quantity: 2 } })).toBe(2)
    expect(unitsOfLine({ id: "l", quantity: 4 })).toBe(4)
    expect(unitsOfLine({ id: "l" })).toBe(0)
    expect(unitsOfLine({ id: "l", quantity: "x" })).toBe(0)
  })

  it("moves the cart's travelers to the booking it confirms (adr/0076 §7)", async () => {
    const bookings = bookingService()
    const { container } = containerOf(
      { order: [{ id: "order_1", status: "pending", cart: { id: "cart_1" }, items: [datedLine] }] },
      bookings
    )

    expect(await confirmOrderBookings(container, "order_1")).toBe("confirmed")
    expect(bookings.attachTravelers).toHaveBeenCalledWith("cart_1", "bkng_1")
  })

  it("keeps the booking when its travelers cannot follow, and logs only the order", async () => {
    const error = jest.spyOn(logger, "error").mockImplementation(() => undefined)
    const bookings = bookingService({
      attachTravelers: jest.fn().mockRejectedValue(new Error("connection lost")),
    })
    const { container } = containerOf(
      { order: [{ id: "order_1", status: "pending", cart: { id: "cart_1" }, items: [datedLine] }] },
      bookings
    )

    expect(await confirmOrderBookings(container, "order_1")).toBe("confirmed")
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "booking.travelers_attach_failed", order_id: "order_1" })
    )
    error.mockRestore()
  })

  it("logs no error line for a quiet retry of the reconcile job", async () => {
    const error = jest.spyOn(logger, "error").mockImplementation(() => undefined)
    const bookings = bookingService({
      confirmHold: jest.fn().mockRejectedValue({ safeMessage: "booking.hold_missing" }),
      holdUnits: jest.fn().mockRejectedValue({ safeMessage: "booking.slot_full" }),
    })
    const { container } = containerOf(
      { order: [{ id: "order_1", status: "pending", display_id: 42, items: [datedLine] }] },
      bookings
    )

    expect(await confirmOrderBookings(container, "order_1", { quiet: true })).toBe("failed")
    expect(error).not.toHaveBeenCalled()
    expect(await confirmOrderBookings(container, "order_1")).toBe("failed")
    expect(error).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })
})

describe("an order edit beside a departure's places (adr/0076 Ek, review O2)", () => {
  const plainLine = { id: "ordli_2", metadata: null }

  it("refuses changing or taking off a dated line", async () => {
    const { container } = containerOf({})
    for (const quantity of [3, 0]) {
      await expect(
        refuseBookingEdits(container, [datedLine, plainLine], {
          items: [{ id: "ordli_1", quantity }],
          add: [],
        } as never)
      ).rejects.toMatchObject({ safeMessage: "booking.order_edit_unavailable" })
    }
  })

  it("refuses adding a dated product's variant, and lets the rest through", async () => {
    const { container, graph } = containerOf({
      product_variant: [
        { id: "variant_tour", product: { product_extension: { booking_mode: "departure" } } },
      ],
    })

    await expect(
      refuseBookingEdits(container, [plainLine], {
        items: [],
        add: [{ variant_id: "variant_tour" }],
      })
    ).rejects.toMatchObject({ safeMessage: "booking.order_edit_unavailable" })

    const plain = containerOf({ product_variant: [{ id: "variant_knife", product: null }] })
    await expect(
      refuseBookingEdits(plain.container, [datedLine, plainLine], {
        items: [{ id: "ordli_2" }],
        add: [{ variant_id: "variant_knife" }],
      })
    ).resolves.toBeUndefined()
    // No new variant, no read
    await refuseBookingEdits(container, [plainLine], { items: [{ id: "ordli_2" }], add: [] })
    expect(graph).toHaveBeenCalledTimes(1)
  })
})
