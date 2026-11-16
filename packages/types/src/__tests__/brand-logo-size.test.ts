import { describe, expect, it } from "vitest"
import { brandLogoSize } from "../store/catalog.js"

describe("a brand logo's size (the Store API's logo_width and logo_height)", () => {
  it("reads both sides when the answer gives them as whole pixels", () => {
    expect(brandLogoSize({ logo_width: 600, logo_height: 200 })).toEqual({
      width: 600,
      height: 200,
    })
    expect(brandLogoSize({ logo_width: 1, logo_height: 1 })).toEqual({ width: 1, height: 1 })
  })

  it("says nothing when a side is unknown, absent or no size to draw by", () => {
    expect(brandLogoSize({})).toBeNull()
    expect(brandLogoSize({ logo_width: null, logo_height: null })).toBeNull()
    expect(brandLogoSize({ logo_width: 600 })).toBeNull()
    expect(brandLogoSize({ logo_width: 600, logo_height: null })).toBeNull()
    for (const side of [0, -40, 12.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(brandLogoSize({ logo_width: side, logo_height: 200 })).toBeNull()
      expect(brandLogoSize({ logo_width: 600, logo_height: side })).toBeNull()
    }
    // A wrong type from an older or broken answer reads as unknown
    expect(brandLogoSize({ logo_width: "600", logo_height: "200" } as never)).toBeNull()
  })
})
