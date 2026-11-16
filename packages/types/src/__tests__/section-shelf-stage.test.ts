import { describe, expect, it } from "vitest"
import {
  SHELF_LIMITS,
  SHELF_STAGE_DEFAULTS,
  SHELF_STAGE_SETTINGS,
  SHELF_STAGE_SETTING_NAMES,
  shelfJoins,
  shelfLimit,
  shelfStageCountOf,
  shelfStageOf,
} from "../store/section-shelf.js"
import { SECTION_VARIANTS, variantOf } from "../store/section-variants.js"

describe("a product rail's stage list variant (adr/0049 Ek 2026-11-16)", () => {
  it("comes last on the rail's list, today's grid still the default", () => {
    expect(SECTION_VARIANTS.products.at(-1)).toBe("stage_list")
    expect(SECTION_VARIANTS.products[0]).toBe("grid")
    expect(variantOf("products", undefined)).toBe("grid")
    expect(variantOf("products", "stage_list")).toBe("stage_list")
  })

  it("offers the side, the ground and the follow, each list's first the default", () => {
    expect(SHELF_STAGE_SETTING_NAMES).toEqual(["stage_side", "stage_ground", "stage_follow"])
    expect(SHELF_STAGE_SETTINGS).toEqual({
      stage_side: ["start", "end"],
      stage_ground: ["stage", "well"],
      stage_follow: ["on", "off"],
    })
    for (const name of SHELF_STAGE_SETTING_NAMES) {
      expect(SHELF_STAGE_DEFAULTS[name]).toBe(SHELF_STAGE_SETTINGS[name][0])
    }
  })

  it("reads a missing or unknown step as its default", () => {
    expect(shelfStageOf({})).toEqual(SHELF_STAGE_DEFAULTS)
    expect(shelfStageOf({ stage_side: "end", stage_follow: "off" })).toEqual({
      stage_side: "end",
      stage_ground: "stage",
      stage_follow: "off",
    })
    expect(shelfStageOf({ stage_side: "top", stage_ground: true })).toEqual(SHELF_STAGE_DEFAULTS)
  })

  it("asks its source for three to six products, four by default", () => {
    expect(SHELF_LIMITS.stage_list).toEqual({ counts: [3, 4, 5, 6], default: 4 })
    expect(shelfStageCountOf(undefined)).toBe(4)
    expect(shelfStageCountOf(2)).toBe(4)
    expect(shelfStageCountOf(7)).toBe(4)
    expect(shelfStageCountOf(6)).toBe(6)
    expect(shelfLimit({ variant: "stage_list", limit: 12 })).toBe(4)
    expect(shelfLimit({ variant: "stage_list", limit: 12, stage_count: 3 })).toBe(3)
    // The shop's limit stays the grid's
    expect(shelfLimit({ variant: "grid", limit: 12, stage_count: 3 })).toBe(12)
  })

  it("may join its neighbours' tabs like any rail but columns", () => {
    expect(shelfJoins({ variant: "stage_list" })).toBe(true)
    expect(shelfJoins({ variant: "stage_list", tabs: "off" })).toBe(false)
  })
})
