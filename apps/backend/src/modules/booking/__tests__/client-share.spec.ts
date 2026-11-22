import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { BOOKING_MODULE } from ".."
import { CLIENT_LIVE_UNITS } from "../client-share"
import type BookingModuleService from "../service"

jest.setTimeout(120 * 1000)

const HOUR = 60 * 60 * 1000

/** adr/0076 Ek takip M1: one address's live holds capped, under its lock. */
moduleIntegrationTestRunner<BookingModuleService>({
  moduleName: BOOKING_MODULE,
  resolve: "./src/modules/booking",
  testSuite: ({ service, MikroOrmWrapper }) => {
    let bookableId: string
    let run = 0

    beforeEach(async () => {
      run += 1
      const bookable = await service.createBookables({
        product_id: `prod_share_${String(Date.now())}_${String(run)}`,
      })
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
    // Keyed hashes as the route makes them; no address in the fixture
    const client = (hash: string, maxPerSlot: number) => ({ hash, maxPerSlot })
    const cart = (name: string) => `cart_${name}_${String(run)}`
    const messageOf = async (promise: Promise<unknown>) => {
      try {
        await promise
        return null
      } catch (error) {
        return (error as { safeMessage?: string }).safeMessage ?? String(error)
      }
    }

    it("refuses the address's second cart past the departure's share, and tags the hold", async () => {
      const [slotId = ""] = await slots(1, 50)
      const a = client("hash_a", 10)

      await service.holdUnits(cart("one"), [{ slotId, units: 6 }], 20, a)
      const refused = await messageOf(service.holdUnits(cart("two"), [{ slotId, units: 5 }], 20, a))
      await service.holdUnits(cart("two"), [{ slotId, units: 4 }], 20, a)

      expect(refused).toBe("booking.client_share")
      expect((await service.slotAvailability([slotId]))[0]?.held).toBe(10)
      const tags = (await sql(
        `SELECT DISTINCT client_hash FROM booking_hold WHERE cart_id IN (?, ?)`,
        [cart("one"), cart("two")]
      )) as { client_hash: string }[]
      expect(tags.map((row) => row.client_hash)).toEqual(["hash_a"])
    })

    it("leaves another address free, and does not count expired holds", async () => {
      const [slotId = ""] = await slots(1, 50)
      await service.holdUnits(cart("a1"), [{ slotId, units: 10 }], 20, client("hash_x", 10))

      await service.holdUnits(cart("b1"), [{ slotId, units: 10 }], 20, client("hash_y", 10))
      await sql(
        `UPDATE booking_hold SET expires_at = now() - interval '1 minute' WHERE cart_id = ?`,
        [cart("a1")]
      )
      await service.holdUnits(cart("a2"), [{ slotId, units: 10 }], 20, client("hash_x", 10))

      expect((await service.slotAvailability([slotId]))[0]?.held).toBe(20)
    })

    it("caps the address's live places over every departure", async () => {
      const ids = await slots(7, 100)
      const a = client("hash_total", 20)
      for (const [index, slotId] of ids.slice(0, 6).entries()) {
        await service.holdUnits(cart(`t${String(index)}`), [{ slotId, units: 10 }], 20, a)
      }

      const refused = await messageOf(
        service.holdUnits(cart("t6"), [{ slotId: ids[6] ?? "", units: 1 }], 20, a)
      )

      expect(refused).toBe("booking.client_share")
      expect(CLIENT_LIVE_UNITS).toBe(60)
    })

    it("never lets carts of one address asking at once go past its share together", async () => {
      const [slotId = ""] = await slots(1, 100)
      const a = client("hash_race", 10)

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, (_, index) =>
          service.holdUnits(cart(`r${String(index)}`), [{ slotId, units: 3 }], 20, a)
        )
      )

      // 3 + 3 + 3 fit a share of 10; a fourth would make 12
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3)
      expect((await service.slotAvailability([slotId]))[0]?.held).toBe(9)
    })

    it("does not cap a hold changed without an address (the undo, the cart's own sync)", async () => {
      const [slotId = ""] = await slots(1, 50)
      await service.holdUnits(cart("n1"), [{ slotId, units: 10 }], 20, client("hash_n", 10))

      await service.holdUnits(cart("n2"), [{ slotId, units: 10 }], 20)
      await service.holdUnits(cart("n1"), [{ slotId, units: 4 }], 20)

      const [tag] = (await sql(`SELECT client_hash FROM booking_hold WHERE cart_id = ?`, [
        cart("n1"),
      ])) as { client_hash: string | null }[]
      // A change without an address keeps the hold's tag
      expect(tag?.client_hash).toBe("hash_n")
      expect((await service.slotAvailability([slotId]))[0]?.held).toBe(14)
    })
  },
})
