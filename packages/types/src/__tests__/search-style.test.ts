import { describe, expect, it } from "vitest"
import { HEADER_SEARCH_STYLES, headerSearchStyleOf } from "../store/section-variants.js"

describe("the header search's look (adr/0049 Ek 2026-11-15)", () => {
  it("names two steps, the box drawn open (the drawing from before) first", () => {
    expect(HEADER_SEARCH_STYLES).toEqual(["field", "icon"])
  })

  it("reads a step as written, and none or one off the list as the box", () => {
    for (const step of HEADER_SEARCH_STYLES) {
      expect(headerSearchStyleOf(step)).toBe(step)
    }
    for (const stray of [undefined, null, true, false, "button", ""]) {
      expect(headerSearchStyleOf(stray)).toBe("field")
    }
  })
})
