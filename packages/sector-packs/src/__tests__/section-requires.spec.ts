import { join } from "node:path"
import { SECTION_REQUIRES, checkPresetFlags, sectorPacks } from "../index"
import type { PresetLayout } from "../index"

// The contract's own file (`@qticaret/types`): the loader reads no runtime value from it
const CONTRACT_FILE = join(__dirname, "../../../types/src/store/section-requires.ts")

const layout = (type: string, onPage = false): PresetLayout =>
  onPage
    ? {
        home: [{ id: "acilis", type: "hero" }],
        pages: [{ page_id: { $handle: "page:turlar" }, sections: [{ id: "kalkislar", type }] }],
      }
    : {
        home: [
          { id: "acilis", type: "hero" },
          { id: "kalkislar", type },
        ],
      }

const pack = (flags: { key: string; enabled: boolean }[], presetLayout: PresetLayout) => ({
  code: "travel",
  flags,
  presets: [{ code: "rota", layout: presetLayout }],
})

describe("a preset's flagged sections (adr/0077 §8)", () => {
  it("mirrors the contract's list, whose first flagged section is the departures", () => {
    const contract = jest.requireActual<{ SECTION_REQUIRES: unknown }>(CONTRACT_FILE)
    expect(SECTION_REQUIRES).toEqual(contract.SECTION_REQUIRES)
    expect(SECTION_REQUIRES).toMatchObject({ departures: "catalog.booking" })
  })

  it("refuses a look laying one out in a pack that does not turn its flag on", () => {
    expect(() => {
      checkPresetFlags(pack([], layout("departures")), SECTION_REQUIRES)
    }).toThrow(
      "travel/presets/rota: section departures needs flag catalog.booking, which flags.json does not turn on"
    )
    // Named but off is not on; a content page's section counts too
    expect(() => {
      checkPresetFlags(
        pack([{ key: "catalog.booking", enabled: false }], layout("departures", true)),
        SECTION_REQUIRES
      )
    }).toThrow("section departures needs flag catalog.booking")
  })

  it("takes it where the pack turns the flag on, and any section no flag guards", () => {
    expect(() => {
      checkPresetFlags(
        pack([{ key: "catalog.booking", enabled: true }], layout("departures")),
        SECTION_REQUIRES
      )
    }).not.toThrow()
    expect(() => {
      checkPresetFlags(pack([], layout("faq")), SECTION_REQUIRES)
    }).not.toThrow()
  })

  it("passes every pack on disk", () => {
    expect(() => sectorPacks(join(__dirname, "../../packs"))).not.toThrow()
  })
})
