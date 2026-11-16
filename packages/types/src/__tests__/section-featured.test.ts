import { describe, expect, it } from "vitest"
import {
  FEATURED_PRODUCT_DEFAULTS,
  FEATURED_PRODUCT_SETTINGS,
  FEATURED_PRODUCT_SETTING_NAMES,
  FEATURED_STRIPS_SETTINGS,
  featuredProductSettingsOf,
} from "../store/section-featured.js"

describe("the featured product's settings (adr/0049 Ek 2026-11-15)", () => {
  it("names the photographs' layout, today's collage first", () => {
    expect(FEATURED_PRODUCT_SETTING_NAMES[0]).toBe("gallery")
    expect(FEATURED_PRODUCT_SETTINGS.gallery).toEqual(["collage", "strips"])
  })

  it("reads a section saved before them as it was drawn: the collage", () => {
    expect(FEATURED_PRODUCT_DEFAULTS.gallery).toBe("collage")
    expect(featuredProductSettingsOf({})).toEqual(FEATURED_PRODUCT_DEFAULTS)
    expect(featuredProductSettingsOf({ gallery: "strips" }).gallery).toBe("strips")
    expect(featuredProductSettingsOf({ gallery: "mosaic" }).gallery).toBe("collage")
  })
})

describe("the strips' look (adr/0049 Ek 2026-11-16)", () => {
  it("names each setting's steps, the panel's order the list's", () => {
    expect(FEATURED_PRODUCT_SETTING_NAMES).toEqual(["gallery", ...FEATURED_STRIPS_SETTINGS])
    expect(FEATURED_PRODUCT_SETTINGS).toMatchObject({
      strips_layout: ["side", "wide"],
      strips_slant: ["soft", "medium", "steep"],
      strips_line: ["none", "thin", "medium", "thick"],
      strips_overlap: ["off", "on"],
      strips_dim: ["off", "on"],
    })
  })

  it("takes the bolder drawing by default: steeper seams, a thin line, the others darkening", () => {
    expect(FEATURED_PRODUCT_DEFAULTS).toEqual({
      gallery: "collage",
      strips_layout: "side",
      strips_slant: "medium",
      strips_line: "thin",
      strips_overlap: "off",
      strips_dim: "on",
    })
  })

  it("reads a step off its list as its default, the others kept", () => {
    expect(
      featuredProductSettingsOf({ gallery: "strips", strips_slant: "steep", strips_line: "huge" })
    ).toMatchObject({ gallery: "strips", strips_slant: "steep", strips_line: "thin" })
  })
})
