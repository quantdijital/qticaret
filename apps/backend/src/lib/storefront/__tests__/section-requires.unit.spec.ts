import path from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  CAPABILITY_GROUPS,
  SECTION_REQUIRES,
  requiredFlag,
  requiredFlags,
  typesOff,
  withoutTypesOff,
} from "../sections/requires"
import { offKey, sectionTypesOff } from "../../../workflows/storefront/layout-flags"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-requires.ts"
)

// A list of the tests' own beside the real one (whose first is the departures)
const REQUIRES = { departures: "catalog.booking", tour_map: "catalog.booking", hero: "x.other" }

const sections = [
  { id: "acilis", type: "hero" },
  { id: "kalkislar", type: "departures" },
  { id: "sss", type: "faq" },
]

describe("sections that need a feature flag (adr/0077 §8)", () => {
  it("mirrors the contract's lists: a flagged section goes there first", () => {
    const contract = jest.requireActual<{ SECTION_REQUIRES: unknown; CAPABILITY_GROUPS: unknown }>(
      CONTRACT_FILE
    )
    expect(SECTION_REQUIRES).toEqual(contract.SECTION_REQUIRES)
    expect(CAPABILITY_GROUPS).toEqual(contract.CAPABILITY_GROUPS)
    expect(SECTION_REQUIRES).toEqual({ departures: "catalog.booking" })
  })

  it("names a type's flag, none for a type off the list", () => {
    expect(requiredFlag("departures", REQUIRES)).toBe("catalog.booking")
    expect(requiredFlag("faq", REQUIRES)).toBeNull()
    expect(requiredFlag("toString", REQUIRES)).toBeNull()
    expect(requiredFlags(REQUIRES)).toEqual(["catalog.booking", "x.other"])
  })

  it("reads each flag a section needs once, and gives the types whose flag is off", async () => {
    const isEnabled = jest.fn((flag: string) => Promise.resolve(flag === "x.other"))
    const off = await typesOff(isEnabled, REQUIRES)

    expect(isEnabled).toHaveBeenCalledTimes(2)
    expect([...off]).toEqual([
      ["departures", "catalog.booking"],
      ["tour_map", "catalog.booking"],
    ])
    expect(offKey(off)).toBe("departures,tour_map")
  })

  it("leaves a section whose flag is off out of what the storefront is given, the rest in order", () => {
    const off = new Map([["departures", "catalog.booking"]])

    expect(withoutTypesOff(sections, off).map((each) => each.id)).toEqual(["acilis", "sss"])
    expect(withoutTypesOff(sections, new Map())).toEqual(sections)
  })

  it("reads no flag while no section needs one", async () => {
    const resolve = jest.fn()
    const container = { resolve } as unknown as MedusaContainer

    expect(await sectionTypesOff(container, {})).toEqual(new Map())
    expect(resolve).not.toHaveBeenCalled()
  })

  it("reads the shop's flags through the settings module when one does", async () => {
    const isFeatureEnabled = jest.fn(() => Promise.resolve(false))
    const container = { resolve: () => ({ isFeatureEnabled }) } as unknown as MedusaContainer

    const off = await sectionTypesOff(container)

    expect(isFeatureEnabled).toHaveBeenCalledWith("catalog.booking")
    expect(off.get("departures")).toBe("catalog.booking")
  })
})
