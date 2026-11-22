import { TRAVELER_KEEP_DAYS } from "../../../lib/booking/travelers"
import { attachTravelers, refreshTravelerPurge } from "../traveler-attach"
import type { Executor } from "../sql"

/** An executor that records each statement; the booking's departures answer its SELECT. */
function recorder(departures: Record<string, unknown>[], updatedPerSlot = 1) {
  const calls: { sql: string; params: unknown[] }[] = []
  const manager: Executor = {
    execute: (sql, params) => {
      calls.push({ sql, params })
      const text = sql.trim()
      if (text.startsWith("SELECT")) {
        return Promise.resolve(departures)
      }
      if (text.startsWith("UPDATE")) {
        return Promise.resolve(
          Array.from({ length: updatedPerSlot }, (_, i) => ({ id: `t${String(i)}` }))
        )
      }
      return Promise.resolve([])
    },
  }
  return { manager, calls }
}

const departure = (slot: string, units: number, level: string) => ({
  slot_id: slot,
  units,
  traveler_fields: { level },
})

describe("a booking's travelers (adr/0076 §7, review O2)", () => {
  it("reads the departures of this booking only", async () => {
    const { manager, calls } = recorder([])
    await attachTravelers(manager, "cart_1", "bkng_1")

    expect(calls[0]?.sql).toMatch(/FROM booking_slot_use u/)
    expect(calls[0]?.params).toEqual(["bkng_1"])
  })

  it("deletes the cart's unbooked travelers beyond the departures and places it took", async () => {
    const { manager, calls } = recorder([
      departure("bkslot_a", 2, "identity"),
      departure("bkslot_b", 1, "none"),
    ])
    await attachTravelers(manager, "cart_1", "bkng_1")

    const remove = calls[1]
    expect(remove?.sql).toMatch(/DELETE FROM booking_traveler/)
    expect(remove?.sql).toMatch(/booking_id IS NULL/)
    // A departure that asks nothing now keeps none
    expect(remove?.sql).toMatch(/NOT \(\(slot_id = \? AND position < \?\)\)/)
    expect(remove?.params).toEqual(["cart_1", "bkslot_a", 2])
  })

  it("deletes every unbooked traveler when the booking keeps none", async () => {
    const { manager, calls } = recorder([departure("bkslot_a", 1, "none")])
    expect(await attachTravelers(manager, "cart_1", "bkng_1")).toBe(0)

    expect(calls[1]?.sql).toMatch(/NOT \(false\)/)
    expect(calls).toHaveLength(2)
  })

  it("empties the fields the product no longer asks", async () => {
    const { manager, calls } = recorder([departure("bkslot_a", 1, "name")])
    expect(await attachTravelers(manager, "cart_1", "bkng_1")).toBe(1)

    const update = calls[2]?.sql ?? ""
    expect(update).toMatch(/birth_date = NULL/)
    expect(update).toMatch(/nationality = NULL/)
    expect(update).toMatch(/document_encrypted = NULL/)
    expect(update).toMatch(/document_hash = NULL/)
    expect(update).toMatch(/document_last4 = NULL/)
    expect(update).toMatch(/key_version = NULL/)
    expect(calls[2]?.params).toEqual(["bkng_1", "cart_1", "bkslot_a"])
  })

  it("keeps what the product still asks", async () => {
    const { manager, calls } = recorder([departure("bkslot_a", 1, "identity")])
    await attachTravelers(manager, "cart_1", "bkng_1")

    const update = calls[2]?.sql ?? ""
    expect(update).toMatch(/birth_date = birth_date/)
    expect(update).toMatch(/document_encrypted = document_encrypted/)
    expect(update).toMatch(/nationality = NULL/)
  })

  it("moves a departure's travelers' deletion date with its own", async () => {
    const { manager, calls } = recorder([])
    await refreshTravelerPurge(manager, "bkslot_a")

    expect(calls[0]?.sql).toMatch(/SET purge_after = COALESCE\(s\.ends_at, s\.starts_at\)/)
    expect(calls[0]?.params).toEqual([TRAVELER_KEEP_DAYS * 24 * 60 * 60, "bkslot_a"])
  })
})
