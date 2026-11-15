import { describe, expect, it } from "vitest"
import { SECTION_LOOK } from "../store/section-look.js"
import { MARQUEE_SETTINGS, marqueeStepOf } from "../store/section-marquee.js"
import { HEADER_MENU_GROUNDS, headerMenuGroundOf } from "../store/section-variants.js"

describe("one name for each ground (bilesen-denetimi (b) 5, O5)", () => {
  it("names the light tint as the look does, in the strip and the menu bar alike", () => {
    expect(SECTION_LOOK.ground).toContain("well")
    expect(MARQUEE_SETTINGS.ground).toEqual(["stage", "primary", "well"])
    expect(HEADER_MENU_GROUNDS).toEqual(["stage", "primary", "well"])
    for (const grounds of [MARQUEE_SETTINGS.ground, HEADER_MENU_GROUNDS]) {
      expect(grounds).not.toContain("light")
    }
  })

  it("reads the light tint's old name as the dictionary's, and an unknown one as the default", () => {
    expect(marqueeStepOf("ground", "light")).toBe("well")
    expect(marqueeStepOf("ground", "well")).toBe("well")
    expect(headerMenuGroundOf("light")).toBe("well")
    expect(headerMenuGroundOf("primary")).toBe("primary")
    expect(headerMenuGroundOf("page")).toBe("stage")
    expect(headerMenuGroundOf(undefined)).toBe("stage")
  })
})
