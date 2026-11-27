import { describe, expect, it } from "vitest"
import { HEADER_SUBMENU_STYLES, headerSubmenuStyleOf } from "../store/section-variants.js"

describe("how the header's submenus open (adr/0049 Ek 2026-11-26)", () => {
  it("names two steps, the dropdown list (the drawing from before) first", () => {
    expect(HEADER_SUBMENU_STYLES).toEqual(["list", "mega"])
  })

  it("reads a step as written, and none or one off the list as the list", () => {
    for (const step of HEADER_SUBMENU_STYLES) {
      expect(headerSubmenuStyleOf(step)).toBe(step)
    }
    for (const stray of [undefined, null, true, "panel", ""]) {
      expect(headerSubmenuStyleOf(stray)).toBe("list")
    }
  })
})
