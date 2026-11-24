import { describe, expect, it } from "vitest"
import {
  GROUP_TYPES,
  NO_FLAGS,
  allowedTypes,
  chooserGroups,
  offCapability,
  typesFor,
} from "./sections"
import type { SectionFlags } from "./sections"

// A list of the tests' own (a type every page takes), beside the real one
const REQUIRES = { faq: "catalog.booking" }
const NONE: SectionFlags = { on: new Set(), requires: {} }
const off: SectionFlags = { on: new Set(), requires: REQUIRES }
const on: SectionFlags = { on: new Set(["catalog.booking"]), requires: REQUIRES }

describe("sections that need a feature flag in the chooser (adr/0077 §8)", () => {
  it("offers every type while none needs a flag", () => {
    expect(typesFor("home", NONE)).toEqual(GROUP_TYPES.home)
    expect(chooserGroups(GROUP_TYPES.home, NONE)).toEqual([
      { capability: null, types: GROUP_TYPES.home },
    ])
  })

  it("offers the upcoming departures only while dated products are on (adr/0077 §10)", () => {
    const booking: SectionFlags = { ...NO_FLAGS, on: new Set(["catalog.booking"]) }

    expect(GROUP_TYPES.home).toContain("departures")
    expect(typesFor("home", NO_FLAGS)).toEqual(
      GROUP_TYPES.home.filter((type) => type !== "departures")
    )
    expect(typesFor("pages", NO_FLAGS)).not.toContain("departures")
    expect(typesFor("product", booking)).not.toContain("departures")
    const groups = chooserGroups(typesFor("home", booking), booking)
    expect(groups.map((group) => group.capability)).toEqual([null, "dated"])
    expect(groups[1]?.types).toEqual(["departures"])
    expect(typesFor("pages", booking)).toContain("departures")
    expect(offCapability("departures", NO_FLAGS)).toBe("dated")
  })

  it("does not offer a type whose flag is off, on any page", () => {
    expect(typesFor("home", off)).not.toContain("faq")
    expect(typesFor("product", off)).not.toContain("faq")
    expect(typesFor("home", off)).toHaveLength(GROUP_TYPES.home.length - 1)
    expect(allowedTypes(["faq", "banner"], off)).toEqual(["banner"])
  })

  it("groups a flagged type under its capability, after the general ones, while on", () => {
    const groups = chooserGroups(typesFor("category", on), on)

    expect(groups.map((group) => group.capability)).toEqual([null, "dated"])
    expect(groups[1]?.types).toEqual(["faq"])
    expect(groups[0]?.types).not.toContain("faq")
  })

  it("names the capability a saved section's flag leaves off, none when on or unflagged", () => {
    expect(offCapability("faq", off)).toBe("dated")
    expect(offCapability("faq", on)).toBeNull()
    expect(offCapability("banner", off)).toBeNull()
  })
})
