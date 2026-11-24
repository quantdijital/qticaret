import { describe, expect, it } from "vitest"
import { needsFlags, withFeatures } from "../section-features"

// The tests' own list, beside the real one (whose first is the departures, adr/0077 §10)
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
    // The real list: the departures need dated products' flag
    expect(needsFlags(sections)).toBe(true)
    expect(needsFlags([{ type: "hero" }])).toBe(false)
    expect(withFeatures(sections, undefined).map((each) => each.id)).toEqual(["acilis"])
  })
})
