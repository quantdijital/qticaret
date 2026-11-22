import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { BOOKING_MODULE } from ".."
import type BookingModuleService from "../service"

jest.setTimeout(120 * 1000)

const keyOf = (error: unknown): string | undefined =>
  (error as { safeMessage?: string }).safeMessage

const HOUR = 60 * 60 * 1000

moduleIntegrationTestRunner<BookingModuleService>({
  moduleName: BOOKING_MODULE,
  resolve: "./src/modules/booking",
  testSuite: ({ service }) => {
    let bookableId: string

    beforeEach(async () => {
      const bookable = await service.createBookables({ product_id: `prod_${String(Date.now())}` })
      bookableId = bookable.id
    })

    const slot = async (capacity: number, status: "open" | "closed" = "open") =>
      (
        await service.createBookingSlots({
          bookable_id: bookableId,
          starts_at: new Date(Date.now() + 48 * HOUR),
          capacity,
          status,
        })
      ).id

    const counters = async (id: string) => {
      const row = await service.retrieveBookingSlot(id)
      return { sold: row.sold, held: row.held }
    }

    it("holds places up to the capacity and refuses the next as full", async () => {
      const id = await slot(2)

      const first = await service.holdUnits("cart_a", [{ slotId: id, units: 2 }], 20)
      const refused = await service.holdUnits("cart_b", [{ slotId: id, units: 1 }], 20).catch(keyOf)

      expect(first?.hold_id).toBeTruthy()
      expect(refused).toBe("booking.slot_full")
      expect(await counters(id)).toEqual({ sold: 0, held: 2 })
    })

    it("refuses a closed slot apart from a full one", async () => {
      const id = await slot(5, "closed")

      const refused = await service.holdUnits("cart_a", [{ slotId: id, units: 1 }], 20).catch(keyOf)

      expect(refused).toBe("booking.slot_closed")
    })

    it("lets exactly the capacity through when twenty carts hold at once", async () => {
      const id = await slot(5)

      const results = await Promise.allSettled(
        Array.from({ length: 20 }, (_, index) =>
          service.holdUnits(`cart_${String(index)}`, [{ slotId: id, units: 1 }], 20)
        )
      )

      const taken = results.filter((result) => result.status === "fulfilled")
      const refused = results.flatMap((result) =>
        result.status === "rejected" ? [keyOf(result.reason)] : []
      )
      expect(taken).toHaveLength(5)
      expect(refused).toEqual(Array.from({ length: 15 }, () => "booking.slot_full"))
      expect(await counters(id)).toEqual({ sold: 0, held: 5 })
      expect(await service.listBookingHolds({})).toHaveLength(5)
    })

    it("never passes the capacity with uneven holds at once", async () => {
      const id = await slot(5)

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, index) =>
          service.holdUnits(`cart_${String(index)}`, [{ slotId: id, units: 2 }], 20)
        )
      )

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2)
      expect(await counters(id)).toEqual({ sold: 0, held: 4 })
    })

    it("changes a cart's hold by the difference and lets it go at zero", async () => {
      const id = await slot(5)

      await service.holdUnits("cart_a", [{ slotId: id, units: 3 }], 20)
      await service.holdUnits("cart_a", [{ slotId: id, units: 1 }], 20)
      expect(await counters(id)).toEqual({ sold: 0, held: 1 })

      const none = await service.holdUnits("cart_a", [{ slotId: id, units: 0 }], 20)
      expect(none).toBeNull()
      expect(await counters(id)).toEqual({ sold: 0, held: 0 })
      expect(await service.listBookingHolds({ cart_id: "cart_a" })).toHaveLength(0)
    })

    it("leaves an expired hold out of reads and sweeps it", async () => {
      const id = await slot(3)
      const hold = await service.holdUnits("cart_a", [{ slotId: id, units: 3 }], 20)
      await service.updateBookingHolds({
        id: hold?.hold_id ?? "",
        expires_at: new Date(Date.now() - 60 * 1000),
      })

      const [read] = await service.slotAvailability([id])
      expect(read).toMatchObject({ capacity: 3, sold: 0, held: 0, available: 3 })
      expect(await service.extendHold("cart_a", 20)).toBeNull()

      expect(await service.releaseExpiredHolds()).toBe(1)
      expect(await counters(id)).toEqual({ sold: 0, held: 0 })
      expect(await service.releaseExpiredHolds()).toBe(0)
    })

    it("frees an expired hold's places for another cart before the sweep", async () => {
      const id = await slot(2)
      const hold = await service.holdUnits("cart_a", [{ slotId: id, units: 2 }], 20)
      await service.updateBookingHolds({
        id: hold?.hold_id ?? "",
        expires_at: new Date(Date.now() - 60 * 1000),
      })

      const taken = await service.holdUnits("cart_b", [{ slotId: id, units: 2 }], 20)

      expect(taken?.hold_id).toBeTruthy()
      expect(await counters(id)).toEqual({ sold: 0, held: 2 })
      expect(await service.listBookingHolds({ cart_id: "cart_a" })).toHaveLength(0)
    })

    it("extends a live hold and never shortens it", async () => {
      const id = await slot(2)
      const hold = await service.holdUnits("cart_a", [{ slotId: id, units: 1 }], 30)

      const shorter = await service.extendHold("cart_a", 10)
      const longer = await service.extendHold("cart_a", 60)

      expect(shorter?.expires_at.getTime()).toBe(hold?.expires_at.getTime())
      expect(longer?.expires_at.getTime()).toBeGreaterThan(hold?.expires_at.getTime() ?? 0)
    })

    it("confirms a hold once, however often it is asked, and cancels it", async () => {
      const id = await slot(4)
      const hold = await service.holdUnits("cart_a", [{ slotId: id, units: 2 }], 20)
      const holdId = hold?.hold_id ?? ""

      const runs = await Promise.all([
        service.confirmHold(holdId, "order_1"),
        service.confirmHold(holdId, "order_1"),
      ])
      const again = await service.confirmHold(holdId, "order_1")
      const other = await service.confirmHold(holdId, "order_2").catch(keyOf)

      expect(runs.filter((run) => run.created)).toHaveLength(1)
      expect(new Set([...runs, again].map((run) => run.booking_id)).size).toBe(1)
      expect(again.created).toBe(false)
      expect(other).toBe("booking.hold_used")
      expect(await counters(id)).toEqual({ sold: 2, held: 0 })
      expect(await service.listBookings({ order_id: "order_1" })).toHaveLength(1)
      expect(await service.listBookingSlotUses({ slot_id: id })).toEqual([
        expect.objectContaining({ units: 2 }),
      ])

      expect(await service.cancelBooking(again.booking_id)).toBe(true)
      expect(await service.cancelBooking(again.booking_id)).toBe(false)
      expect(await counters(id)).toEqual({ sold: 0, held: 0 })
      expect(await service.confirmHold("bkhold_missing", "order_3").catch(keyOf)).toBe(
        "booking.hold_missing"
      )
    })

    it("refuses a capacity below the places sold and held", async () => {
      const id = await slot(4)
      await service.holdUnits("cart_a", [{ slotId: id, units: 3 }], 20)

      const refused = await service.updateSlot(id, { capacity: 2 }).catch(keyOf)
      const lowered = await service.updateSlot(id, { capacity: 3, status: "closed" })

      expect(refused).toBe("booking.capacity_below_sold")
      expect(lowered).toBe(true)
      expect(await service.retrieveBookingSlot(id)).toMatchObject({
        capacity: 3,
        status: "closed",
        held: 3,
      })
      expect(await service.updateSlot("bkslot_missing", { status: "open" })).toBe(false)
    })

    it("keeps the counters inside the capacity at the database too", async () => {
      const id = await slot(1)

      const forced = await service
        .updateSlot(id, { capacity: 0 })
        .then(() => "lowered")
        .catch(() => "refused")
      const [read] = await service.slotAvailability([id])

      expect(forced).toBe("lowered")
      expect(read).toMatchObject({ capacity: 0, available: 0 })
      expect(await service.holdUnits("cart_a", [{ slotId: id, units: 1 }], 20).catch(keyOf)).toBe(
        "booking.slot_full"
      )
      // The checks refuse counters past the capacity, or below zero, written any way
      const overfull = await service
        .createBookingSlots({
          bookable_id: bookableId,
          starts_at: new Date(),
          capacity: 1,
          sold: 2,
        })
        .then(() => "written")
        .catch(() => "refused")
      const negative = await service
        .createBookingSlots({
          bookable_id: bookableId,
          starts_at: new Date(),
          capacity: 1,
          held: -1,
        })
        .then(() => "written")
        .catch(() => "refused")
      expect([overfull, negative]).toEqual(["refused", "refused"])
    })
  },
})
