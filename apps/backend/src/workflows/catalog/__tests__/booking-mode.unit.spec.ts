import type { MedusaContainer } from "@medusajs/framework/types"
import { CATALOG_BOOKING, NON_PHYSICAL_PRODUCTS } from "../../../modules/platform-settings/features"
import { bookingModeOf, bookingVariantsToAlign } from "../booking-mode"

function containerWith(flags: Record<string, boolean>) {
  const isFeatureEnabled = jest.fn((key: string) => Promise.resolve(flags[key] === true))
  return {
    container: { resolve: () => ({ isFeatureEnabled }) } as unknown as MedusaContainer,
    isFeatureEnabled,
  }
}

const ON = { [CATALOG_BOOKING]: true, [NON_PHYSICAL_PRODUCTS]: true }

const keyOf = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => (error as { safeMessage?: string }).safeMessage
  )

describe("bookingModeOf", () => {
  it("sets departure on a service product with both flags on", async () => {
    const { container } = containerWith(ON)

    expect(await bookingModeOf(container, "departure", "none", "service")).toBe("departure")
  })

  it("needs catalog.booking and catalog.non_physical both", async () => {
    for (const flags of [{ [CATALOG_BOOKING]: true }, { [NON_PHYSICAL_PRODUCTS]: true }, {}]) {
      const { container } = containerWith(flags)
      expect(await keyOf(bookingModeOf(container, "departure", "none", "service"))).toBe(
        "catalog.booking_disabled"
      )
    }
  })

  it("refuses the reserved range mode, flags on or not", async () => {
    const { container } = containerWith(ON)

    expect(await keyOf(bookingModeOf(container, "range", "none", "service"))).toBe(
      "catalog.booking_range_unavailable"
    )
  })

  it("refuses a dated product of any kind but service", async () => {
    const { container } = containerWith(ON)

    expect(await keyOf(bookingModeOf(container, "departure", "none", "physical"))).toBe(
      "catalog.booking_kind"
    )
    // A dated product moved to another kind without clearing the mode in the same save
    expect(await keyOf(bookingModeOf(container, undefined, "departure", "digital"))).toBe(
      "catalog.booking_kind"
    )
    // Cleared in the same save: the kind may change
    expect(await bookingModeOf(container, "none", "departure", "physical")).toBe("none")
  })

  it("keeps a dated product as it is with the flags off, and clears without them", async () => {
    const { container, isFeatureEnabled } = containerWith({})

    expect(await bookingModeOf(container, undefined, "departure", "service")).toBeUndefined()
    expect(await bookingModeOf(container, "departure", "departure", "service")).toBe("departure")
    expect(await bookingModeOf(container, "none", "departure", "service")).toBe("none")
    expect(await bookingModeOf(container, undefined, "none", "physical")).toBeUndefined()
    expect(isFeatureEnabled).not.toHaveBeenCalled()
  })
})

describe("bookingVariantsToAlign", () => {
  it("aligns a departure product's variants that track stock or sell past it", () => {
    expect(bookingVariantsToAlign("departure", [{ manage_inventory: true }])).toBe(true)
    expect(bookingVariantsToAlign("departure", [null, { allow_backorder: true }])).toBe(true)
    expect(
      bookingVariantsToAlign("departure", [{ manage_inventory: false, allow_backorder: false }])
    ).toBe(false)
    expect(bookingVariantsToAlign("none", [{ manage_inventory: true }])).toBe(false)
  })
})
