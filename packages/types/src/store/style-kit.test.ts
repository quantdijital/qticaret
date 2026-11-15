import { describe, expect, it } from "vitest"
import {
  STYLE_KIT,
  STYLE_KIT_DEFAULTS,
  STYLE_KIT_FIELDS,
  styleKitAttribute,
  styleKitAttributes,
} from "./style-kit.js"

/** adr/0067 §1: the kit's four new steps; the backend mirrors them (`theme-style-kit.unit.spec.ts`). */
describe("the style kit", () => {
  it("names each field's steps as adr/0067 §1 does, today's drawing first", () => {
    expect(STYLE_KIT).toEqual({
      menu_style: ["filled", "underline", "plain"],
      shadow: ["float", "none"],
      chip_style: ["filled", "lined"],
      media_ground: ["well", "page"],
    })
    expect(STYLE_KIT_FIELDS).toEqual(["menu_style", "shadow", "chip_style", "media_ground"])
  })

  it("defaults each field to its first step, and leaves surface_style out (it came before)", () => {
    for (const field of STYLE_KIT_FIELDS) {
      expect(STYLE_KIT_DEFAULTS[field]).toBe(STYLE_KIT[field][0])
    }
    expect(Object.keys(STYLE_KIT_DEFAULTS)).toEqual(STYLE_KIT_FIELDS)
    expect(STYLE_KIT_FIELDS).not.toContain("surface_style")
  })

  it("marks a step on the root element as a data attribute with dashes", () => {
    expect(STYLE_KIT_FIELDS.map(styleKitAttribute)).toEqual([
      "data-menu-style",
      "data-shadow",
      "data-chip-style",
      "data-media-ground",
    ])
  })

  it("marks nothing at the defaults, nor without a kit (adr/0067 §3b)", () => {
    expect(styleKitAttributes(STYLE_KIT_DEFAULTS)).toEqual({})
    expect(styleKitAttributes(undefined)).toEqual({})
    expect(styleKitAttributes({})).toEqual({})
  })

  it("marks each field off its default, and that one only", () => {
    expect(styleKitAttributes({ ...STYLE_KIT_DEFAULTS, menu_style: "plain" })).toEqual({
      "data-menu-style": "plain",
    })
    expect(
      styleKitAttributes({
        menu_style: "underline",
        shadow: "none",
        chip_style: "lined",
        media_ground: "page",
      })
    ).toEqual({
      "data-menu-style": "underline",
      "data-shadow": "none",
      "data-chip-style": "lined",
      "data-media-ground": "page",
    })
  })
})
