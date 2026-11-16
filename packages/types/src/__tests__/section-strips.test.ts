import { describe, expect, it } from "vitest"
import {
  FEATURED_PRODUCT_DEFAULTS,
  FEATURED_PRODUCT_SETTINGS,
  FEATURED_STRIPS_SETTINGS,
} from "../store/section-featured.js"
import {
  STRIP_GALLERY_DEFAULTS,
  STRIP_GALLERY_LIMITS,
  STRIP_GALLERY_SETTINGS,
  STRIP_GALLERY_SETTING_NAMES,
  STRIP_SOURCE_KINDS,
  stripGallerySettingsOf,
} from "../store/section-strips.js"

/** The strips' look both sections share (the featured product's `strips_layout` is its own). */
const LOOK = ["strips_slant", "strips_line", "strips_overlap", "strips_dim"] as const

describe("the strip gallery's settings (adr/0049 Ek 2026-11-16)", () => {
  it("offers the width, the height and the words before the strips' look", () => {
    expect(STRIP_GALLERY_SETTING_NAMES).toEqual(["width", "height", "captions", ...LOOK])
    expect(STRIP_GALLERY_SETTINGS.width).toEqual(["full", "boxed"])
    expect(STRIP_GALLERY_SETTINGS.height).toEqual(["low", "medium", "high"])
    expect(STRIP_GALLERY_SETTINGS.captions).toEqual(["on", "off"])
  })

  it("draws a new one edge to edge, medium high, with its words", () => {
    expect(STRIP_GALLERY_DEFAULTS).toMatchObject({
      width: "full",
      height: "medium",
      captions: "on",
    })
  })

  it("keeps the strips' look the featured product's: names, steps and defaults", () => {
    expect(FEATURED_STRIPS_SETTINGS).toEqual(expect.arrayContaining([...LOOK]))
    for (const name of LOOK) {
      expect(STRIP_GALLERY_SETTINGS[name]).toEqual(FEATURED_PRODUCT_SETTINGS[name])
      expect(STRIP_GALLERY_DEFAULTS[name]).toBe(FEATURED_PRODUCT_DEFAULTS[name])
    }
  })

  it("reads a missing or unknown step as its default, a known one as saved", () => {
    expect(stripGallerySettingsOf({})).toEqual(STRIP_GALLERY_DEFAULTS)
    expect(stripGallerySettingsOf({ width: "boxed", strips_slant: "steep" })).toMatchObject({
      width: "boxed",
      strips_slant: "steep",
      height: "medium",
    })
    expect(stripGallerySettingsOf({ height: "giant", captions: 1 })).toMatchObject({
      height: "medium",
      captions: "on",
    })
  })
})

describe("a strip's sources and limits", () => {
  it("takes a record of four kinds, or the shop's own picture", () => {
    expect(STRIP_SOURCE_KINDS).toEqual(["product", "category", "collection", "brand", "custom"])
  })

  it("holds two to eight strips", () => {
    expect(STRIP_GALLERY_LIMITS.items).toEqual({ min: 2, max: 8 })
  })
})
