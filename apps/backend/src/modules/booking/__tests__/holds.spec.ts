import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { BOOKING_MODULE } from ".."
import type BookingModuleService from "../service"
import { REFUSED_WRITERS } from "../service"

jest.setTimeout(120 * 1000)

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

/** PR #263 review: lock order, expired holds, hold lifetime, generated writers. */
moduleIntegrationTestRunner<BookingModuleService>({
  moduleName: BOOKING_MODULE,
  resolve: "./src/modules/booking",
  testSuite: ({ service, MikroOrmWrapper }) => {
    let bookableId: string

    beforeEach(async () => {
      const bookable = await service.createBookables({ product_id: `prod_${String(Date.now())}` })
      bookableId = bookable.id
    })

    const slots = (count: number, capacity: number) =>
      service.createSlots(
        Array.from({ length: count }, (_, index) => ({
          bookable_id: bookableId,
          starts_at: new Date(Date.now() + (48 + index) * HOUR),
          capacity,
        }))
      )
    const sql = (text: string, params: unknown[] = []) =>
      MikroOrmWrapper.forkManager().execute(text, params)
    const expireCarts = (carts: string[]) =>
      sql(
        `UPDATE booking_hold SET expires_at = now() - interval '1 minute'
          WHERE cart_id IN (${carts.map(() => "?").join(", ")})`,
        carts
      )
    const heldOn = async (ids: string[]) =>
      (await service.slotAvailability(ids)).map((slot) => slot.held)
    const counted = async (ids: string[]) =>
      Promise.all(ids.map(async (id) => (await service.retrieveBookingSlot(id)).held))

    it("never deadlocks when expired holds share slots crosswise with carts holding at once", async () => {
      const ids = await slots(6, 50)
      const pick = (...indexes: number[]) => indexes.map((index) => ids[index] ?? "")
      // Expired holds crossing every slot in a different pairing
      const crossing = [pick(0, 5), pick(1, 4), pick(2, 3), pick(5, 1), pick(4, 0), pick(3, 2)]
      const expired = crossing.map((_, index) => `cart_old_${String(index)}`)
      for (const [index, pair] of crossing.entries()) {
        await service.holdUnits(
          expired[index] ?? "",
          pair.map((slotId) => ({ slotId, units: 1 })),
          20
        )
      }
      await expireCarts(expired)

      // Each cart wants a pair the old holds' slots straddle in the other order
      const wanted = Array.from({ length: 24 }, (_, index) =>
        pick(index % 6, (index * 5 + 3) % 6).filter((id, at, list) => list.indexOf(id) === at)
      )
      const results = await Promise.allSettled(
        wanted.map((pair, index) =>
          service.holdUnits(
            `cart_new_${String(index)}`,
            pair.map((slotId) => ({ slotId, units: 1 })),
            20
          )
        )
      )

      expect(results.filter((result) => result.status === "rejected")).toEqual([])
      const live = ids.map((id) => wanted.filter((pair) => pair.includes(id)).length)
      // Reads count live holds only; the counters agree once nothing expired is left
      expect(await heldOn(ids)).toEqual(live)
      await service.releaseExpiredHolds()
      expect(await counted(ids)).toEqual(live)
    })

    it("gives an expired hold's places back and starts a new one instead of reviving it", async () => {
      const [first = "", second = ""] = await slots(2, 2)
      const old = await service.holdUnits("cart_a", [{ slotId: first, units: 2 }], 20)
      await expireCarts(["cart_a"])

      const fresh = await service.holdUnits("cart_a", [{ slotId: second, units: 1 }], 20)

      expect(fresh?.hold_id).toBeTruthy()
      expect(fresh?.hold_id).not.toBe(old?.hold_id)
      expect(await counted([first, second])).toEqual([0, 1])
      expect(await service.listBookingHoldSlots({ hold_id: fresh?.hold_id ?? "" })).toEqual([
        expect.objectContaining({ slot_id: second, units: 1 }),
      ])
    })

    it("never pushes a hold past its lifetime, however often it is extended", async () => {
      const [id = ""] = await slots(1, 2)
      const hold = await service.holdUnits("cart_a", [{ slotId: id, units: 1 }], 20)
      await sql(
        `UPDATE booking_hold SET created_at = now() - interval '110 minutes',
                expires_at = now() + interval '5 minutes' WHERE id = ?`,
        [hold?.hold_id ?? ""]
      )

      const extended = await service.extendHold("cart_a", 60)
      const held = await service.holdUnits("cart_a", [{ slotId: id, units: 2 }], 60)

      const cap = Date.now() + 10 * MINUTE + MINUTE
      expect(extended?.expires_at.getTime()).toBeLessThanOrEqual(cap)
      expect(held?.expires_at.getTime()).toBeLessThanOrEqual(cap)
      expect(held?.hold_id).toBe(hold?.hold_id)
    })

    it("refuses the generated writers and removes only empty slots", async () => {
      const [empty = "", used = ""] = await slots(2, 3)
      await service.holdUnits("cart_a", [{ slotId: used, units: 1 }], 20)

      // Called past the types on purpose: in code these calls do not compile
      const writers = service as unknown as Record<string, (...args: unknown[]) => unknown>
      for (const name of REFUSED_WRITERS) {
        const outcome = await Promise.resolve()
          .then(() => writers[name]?.({ id: used, sold: 0, held: 0 }))
          .then(() => "written")
          .catch((error: unknown) => (error as { type?: string }).type)
        expect([name, outcome]).toEqual([name, "not_allowed"])
      }

      expect(await service.deleteEmptySlots([empty, used])).toEqual([empty])
      expect(await counted([used])).toEqual([1])
    })
  },
})
