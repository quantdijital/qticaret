import { describe, expect, it } from "vitest"
import { needsFlags, withFeatures } from "../section-features"

// The list is empty until the first flagged section (adr/0077 §10): a stand-in one
const REQUIRES = { departures: "catalog.booking" }

const sections = [
  { id: "acilis", type: "hero" },
  { id: "kalkislar", type: "departures" },
]

describe("a section that needs a feature flag (adr/0077 §8)", () => {
  it("is drawn only while the frame's features say its flag is on", () => {
    const on = { gift_cards: false, product_addons: false, booking: true }
    const off = { gift_cards: false, product_addons: false, booking: false }

    expect(withFeatures(sections, on, REQUIRES)).toEqual(sections)
    expect(withFeatures(sections, off, REQUIRES).map((each) => each.id)).toEqual(["acilis"])
  })

  it("is left out by a backend that does not say the flag, or says no features", () => {
    expect(
      withFeatures(sections, { gift_cards: true, product_addons: true }, REQUIRES).map(
        (each) => each.id
      )
    ).toEqual(["acilis"])
    expect(withFeatures(sections, undefined, REQUIRES).map((each) => each.id)).toEqual(["acilis"])
  })

  it("asks for the frame only when a section needs a flag", () => {
    expect(needsFlags(sections, REQUIRES)).toBe(true)
    expect(needsFlags([{ type: "hero" }], REQUIRES)).toBe(false)
    // None does yet
    expect(needsFlags(sections)).toBe(false)
    expect(withFeatures(sections, undefined)).toEqual(sections)
  })
})
