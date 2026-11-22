import { describe, expect, it } from "vitest"
import {
  CAPABILITY_GROUPS,
  SECTION_REQUIRES,
  capabilityOf,
  capabilityOfFlag,
  requiredFlag,
  sectionAllowed,
  storefrontFlagOn,
} from "../store/section-requires.js"

// The list is empty until the first flagged section (adr/0077 §10): a stand-in one
const REQUIRES = { departures: "catalog.booking" }

describe("sections that need a feature flag (adr/0077 §8)", () => {
  it("names dated products' capability by its flag and its storefront field", () => {
    expect(CAPABILITY_GROUPS.dated).toEqual({
      flag: "catalog.booking",
      feature: "booking",
      label: "storefront.editor.capabilities.dated",
    })
    expect(capabilityOfFlag("catalog.booking")).toBe("dated")
    expect(capabilityOfFlag("catalog.addons")).toBeNull()
  })

  it("needs no flag for a type off the list, the first list holding none", () => {
    expect(SECTION_REQUIRES).toEqual({})
    expect(requiredFlag("hero")).toBeNull()
    expect(requiredFlag("constructor", REQUIRES)).toBeNull()
    expect(capabilityOf("hero", REQUIRES)).toBeNull()
  })

  it("lets a flagged type show only while its flag is on", () => {
    expect(requiredFlag("departures", REQUIRES)).toBe("catalog.booking")
    expect(capabilityOf("departures", REQUIRES)).toBe("dated")
    expect(sectionAllowed("departures", () => false, REQUIRES)).toBe(false)
    expect(sectionAllowed("departures", (flag) => flag === "catalog.booking", REQUIRES)).toBe(true)
    expect(sectionAllowed("hero", () => false, REQUIRES)).toBe(true)
  })

  it("reads a flag from the storefront's features, absent as off", () => {
    expect(storefrontFlagOn({ booking: true })("catalog.booking")).toBe(true)
    expect(storefrontFlagOn({ booking: false })("catalog.booking")).toBe(false)
    expect(storefrontFlagOn({ gift_cards: true })("catalog.booking")).toBe(false)
    expect(storefrontFlagOn(undefined)("catalog.booking")).toBe(false)
    expect(storefrontFlagOn({ booking: true })("catalog.unknown")).toBe(false)
  })
})
