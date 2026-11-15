import { describe, expect, it } from "vitest"
import { HEADER_MENU_IMAGES, headerMenuImagesOf } from "../store/section-variants.js"

describe("the menus' pictures (adr/0049 Ek 2026-11-15)", () => {
  it("names three steps, the drawing from before the setting among them", () => {
    expect(HEADER_MENU_IMAGES).toEqual(["all", "submenus", "off"])
  })

  it("reads a step as written, and none or one off the list as the drawing from before", () => {
    for (const step of HEADER_MENU_IMAGES) {
      expect(headerMenuImagesOf(step)).toBe(step)
    }
    for (const stray of [undefined, null, true, false, "on", ""]) {
      expect(headerMenuImagesOf(stray)).toBe("submenus")
    }
  })
})
