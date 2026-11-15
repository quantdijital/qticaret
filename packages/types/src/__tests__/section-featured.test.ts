import { describe, expect, it } from "vitest"
import {
  FEATURED_PRODUCT_DEFAULTS,
  FEATURED_PRODUCT_SETTINGS,
  FEATURED_PRODUCT_SETTING_NAMES,
  featuredProductSettingsOf,
} from "../store/section-featured.js"

describe("the featured product's settings (adr/0049 Ek 2026-11-15)", () => {
  it("names the photographs' layout, today's collage first", () => {
    expect(FEATURED_PRODUCT_SETTING_NAMES).toEqual(["gallery"])
    expect(FEATURED_PRODUCT_SETTINGS.gallery).toEqual(["collage", "strips"])
  })

  it("reads a section saved before them as it was drawn: the collage", () => {
    expect(FEATURED_PRODUCT_DEFAULTS).toEqual({ gallery: "collage" })
    expect(featuredProductSettingsOf({})).toEqual(FEATURED_PRODUCT_DEFAULTS)
    expect(featuredProductSettingsOf({ gallery: "strips" })).toEqual({ gallery: "strips" })
    expect(featuredProductSettingsOf({ gallery: "mosaic" })).toEqual({ gallery: "collage" })
  })
})
