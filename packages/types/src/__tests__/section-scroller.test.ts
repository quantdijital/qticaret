import { describe, expect, it } from "vitest"
import {
  ROW_SCROLLER,
  SCROLLER_DEFAULTS,
  SCROLLER_SETTINGS,
  SCROLLER_SETTING_NAMES,
  scrollerSettingsOf,
  scrollerStepOf,
} from "../store/section-scroller.js"
import { SHELF_LIMITS, shelfLimit, shelfPerListOf, shelfRowsOf } from "../store/section-shelf.js"

describe("the scroller kit (adr/0049 Ek 2026-11-15)", () => {
  it("names its settings in the panel's order, each default on its list", () => {
    expect(SCROLLER_SETTING_NAMES).toEqual([
      "desktop",
      "mobile",
      "arrows",
      "arrow_style",
      "arrow_position",
      "dots",
      "autoplay",
      "speed",
      "loop",
      "drag",
      "play_button",
      "dot_style",
      "controls_place",
      "arrow_size",
      "controls_tone",
    ])
    // A row draws the first ten; the rest are the slider's own controls
    expect(ROW_SCROLLER).toEqual(SCROLLER_SETTING_NAMES.slice(0, 10))
    for (const name of SCROLLER_SETTING_NAMES) {
      expect(SCROLLER_SETTINGS[name]).toContain(SCROLLER_DEFAULTS[name])
    }
    expect(SCROLLER_DEFAULTS.autoplay).toBe("off")
  })

  it("reads a step it does not know, or none, as the default", () => {
    expect(scrollerStepOf("arrows", "hover")).toBe("hover")
    expect(scrollerStepOf("arrows", "blink")).toBe("always")
    expect(scrollerSettingsOf(undefined)).toEqual(SCROLLER_DEFAULTS)
    expect(scrollerSettingsOf({ loop: "on", desktop: 9 })).toEqual({
      ...SCROLLER_DEFAULTS,
      loop: "on",
    })
  })
})

describe("a product rail's counts by variant", () => {
  it("is the shop's limit on a grid or a carousel, the variant's own on the others", () => {
    expect(shelfLimit({ limit: 10 })).toBe(10)
    expect(shelfLimit({ variant: "carousel", limit: 10 })).toBe(10)
    expect(shelfLimit({ variant: "featured", limit: 10 })).toBe(SHELF_LIMITS.featured)
    expect(shelfLimit({ variant: "compact", limit: 10, rows: 3 })).toBe(9)
    expect(shelfLimit({ variant: "compact", limit: 10 })).toBe(6)
    expect(shelfLimit({ variant: "columns", limit: 10, per_list: 3 })).toBe(3)
    expect(shelfRowsOf(7)).toBe(2)
    expect(shelfPerListOf("x")).toBe(4)
  })
})
