import { MedusaError } from "@medusajs/framework/utils"
import BookingModuleService, { REFUSED_WRITERS } from "../service"

describe("booking service writers", () => {
  // No database: the refusal happens before any is reached
  const service = new BookingModuleService({}) as unknown as Record<
    string,
    (...args: unknown[]) => unknown
  >

  it("lists a writer for every counter model and verb", () => {
    expect(REFUSED_WRITERS).toHaveLength(29)
    expect(REFUSED_WRITERS).toEqual(
      expect.arrayContaining([
        "createBookingSlots",
        "deleteBookingSlots",
        "updateBookingHolds",
        "restoreBookings",
        "softDeleteBookingSlotUses",
        // A traveler is written only sealed and never soft-deleted (adr/0076 §7)
        "createBookingTravelers",
        "updateBookingTravelers",
        "softDeleteBookingTravelers",
      ])
    )
    expect(REFUSED_WRITERS).not.toContain("deleteBookingTravelers")
  })

  it.each(REFUSED_WRITERS)("refuses %s, so the counters keep their rule", (name) => {
    const write = service[name]
    expect(typeof write).toBe("function")
    let refused: unknown
    try {
      write?.({ id: "bkslot_1", sold: 0, held: 0 })
    } catch (error) {
      refused = error
    }
    expect(refused).toBeInstanceOf(MedusaError)
    expect((refused as MedusaError).type).toBe(MedusaError.Types.NOT_ALLOWED)
  })

  it("keeps the settings' generated writers", () => {
    for (const name of ["createBookables", "updateBookables", "softDeleteBookables"]) {
      expect(typeof service[name]).toBe("function")
    }
  })
})
