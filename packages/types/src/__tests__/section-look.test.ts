import { describe, expect, it } from "vitest"
import { SECTION_LOOK, SECTION_LOOK_FIELDS, lookOf } from "../store/section-look.js"

describe("a section's look (adr/0049 Ek 2026-11-14 §6)", () => {
  it("names the five fields with their steps, in the panel's order", () => {
    expect(SECTION_LOOK_FIELDS).toEqual(["space_outer", "space_inner", "ground", "align", "width"])
    expect(SECTION_LOOK.ground).toEqual(["page", "well", "stage", "primary"])
  })

  it("reads only the steps it knows: none, unset and unknown ones are the theme's", () => {
    expect(lookOf({ ground: "stage", align: null, width: "huge", sparkle: true })).toEqual({
      ground: "stage",
    })
    expect(lookOf(undefined)).toEqual({})
    expect(lookOf(null)).toEqual({})
    expect(lookOf(["ground"])).toEqual({})
  })
})
