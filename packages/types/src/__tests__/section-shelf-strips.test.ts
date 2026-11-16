import { describe, expect, it } from "vitest"
import { FEATURED_PRODUCT_DEFAULTS, FEATURED_PRODUCT_SETTINGS } from "../store/section-featured.js"
import { SHELF_LIMITS, shelfLimit, shelfStripsCountOf } from "../store/section-shelf.js"
import {
  SHELF_STRIPS_DEFAULTS,
  SHELF_STRIPS_SETTINGS,
  SHELF_STRIPS_SETTING_NAMES,
  STRIPS_LOOK_DEFAULTS,
  STRIPS_LOOK_SETTINGS,
  STRIP_GALLERY_DEFAULTS,
  STRIP_GALLERY_SETTINGS,
  shelfStripsOf,
} from "../store/section-strips.js"
import { SECTION_VARIANTS, variantOf } from "../store/section-variants.js"

const LOOK = ["strips_slant", "strips_line", "strips_overlap", "strips_dim"] as const

describe("a product rail's strips variant (adr/0049 Ek 2026-11-16)", () => {
  it("follows the variants before it on the rail's list, today's grid still the default", () => {
    // Later variants (ranked, stage_list, Ek 2026-11-16) come after it
    expect(SECTION_VARIANTS.products.slice(0, 6)).toEqual([
      "grid",
      "carousel",
      "featured",
      "compact",
      "columns",
      "strips",
    ])
    expect(variantOf("products", undefined)).toBe("grid")
    expect(variantOf("products", "strips")).toBe("strips")
  })

  it("offers the height before the shared look, low by default (the gallery stays medium)", () => {
    expect(SHELF_STRIPS_SETTING_NAMES).toEqual(["strips_height", ...LOOK])
    expect(SHELF_STRIPS_SETTINGS.strips_height).toEqual(STRIP_GALLERY_SETTINGS.height)
    expect(SHELF_STRIPS_DEFAULTS.strips_height).toBe("low")
    expect(STRIP_GALLERY_DEFAULTS.height).toBe("medium")
  })

  it("shares the look's names, steps and defaults with the gallery and the featured product", () => {
    expect(Object.keys(STRIPS_LOOK_SETTINGS)).toEqual([...LOOK])
    for (const name of LOOK) {
      expect(SHELF_STRIPS_SETTINGS[name]).toBe(STRIPS_LOOK_SETTINGS[name])
      expect(STRIP_GALLERY_SETTINGS[name]).toBe(STRIPS_LOOK_SETTINGS[name])
      expect(SHELF_STRIPS_SETTINGS[name]).toEqual(FEATURED_PRODUCT_SETTINGS[name])
      expect(SHELF_STRIPS_DEFAULTS[name]).toBe(STRIPS_LOOK_DEFAULTS[name])
      expect(SHELF_STRIPS_DEFAULTS[name]).toBe(FEATURED_PRODUCT_DEFAULTS[name])
    }
  })

  it("reads a missing or unknown step as its default", () => {
    expect(shelfStripsOf({})).toEqual(SHELF_STRIPS_DEFAULTS)
    expect(shelfStripsOf({ strips_height: "high", strips_overlap: "on" })).toMatchObject({
      strips_height: "high",
      strips_overlap: "on",
      strips_slant: "medium",
    })
    expect(shelfStripsOf({ strips_height: "giant", strips_line: 4 })).toMatchObject({
      strips_height: "low",
      strips_line: "thin",
    })
  })

  it("asks its source for two to eight products, five by default", () => {
    expect(SHELF_LIMITS.strips).toEqual({ counts: [2, 3, 4, 5, 6, 7, 8], default: 5 })
    expect(shelfStripsCountOf(undefined)).toBe(5)
    expect(shelfStripsCountOf(9)).toBe(5)
    expect(shelfStripsCountOf(8)).toBe(8)
    expect(shelfLimit({ variant: "strips", limit: 12 })).toBe(5)
    expect(shelfLimit({ variant: "strips", limit: 12, strips_count: 3 })).toBe(3)
    // The shop's limit stays the grid's
    expect(shelfLimit({ variant: "grid", limit: 12, strips_count: 3 })).toBe(12)
  })
})
