import { describe, expect, it } from "vitest"
import { startingKind } from "./catalog-defaults"
import type { CatalogDefaults } from "./catalog-defaults"
import { catalogBody } from "./create-product"
import { defaultWizardValues } from "./schema"

// adr/0076 §12: a new product starts as the shop's catalog defaults say

const dated: CatalogDefaults = {
  new_product_kind: "service",
  new_product_booking_mode: "departure",
  dated_schema_type: "TouristTrip",
}

describe("startingKind", () => {
  it("starts a dated service where both flags are on", () => {
    expect(startingKind(dated, { nonPhysical: true, booking: true })).toEqual({
      kind: "service",
      booking_mode: "departure",
    })
  })

  it("starts a plain service without dated selling, and as a physical good without services", () => {
    expect(startingKind(dated, { nonPhysical: true, booking: false })).toEqual({
      kind: "service",
      booking_mode: "none",
    })
    expect(startingKind(dated, { nonPhysical: false, booking: true })).toBeNull()
  })

  it("leaves the wizard's own default for a physical one", () => {
    expect(
      startingKind(
        { ...dated, new_product_kind: "physical", new_product_booking_mode: "none" },
        { nonPhysical: true, booking: true }
      )
    ).toBeNull()
  })
})

describe("catalogBody", () => {
  it("sends the booking mode with a service sold by departure, and never with another kind", () => {
    const values = defaultWizardValues()
    expect(catalogBody({ ...values, kind: "service", booking_mode: "departure" })).toEqual({
      kind: "service",
      booking_mode: "departure",
    })
    expect(catalogBody({ ...values, kind: "service", booking_mode: "none" })).toEqual({
      kind: "service",
    })
    expect(catalogBody({ ...values, kind: "digital", booking_mode: "departure" })).toEqual({
      kind: "digital",
    })
    expect(catalogBody(values)).toBeNull()
  })
})
