import { describe, expect, it } from "vitest"
import {
  SHELF_LIMITS,
  SHELF_RANKED_LAYOUTS,
  SHELF_RANKED_LAYOUT_DEFAULT,
  shelfLimit,
  shelfRankedCountOf,
  shelfRankedLayoutOf,
} from "../store/section-shelf.js"
import { SECTION_VARIANTS, variantOf } from "../store/section-variants.js"

describe("a product rail's ranked variant (adr/0049 Ek 2026-11-16)", () => {
  it("comes after strips on the rail's list, today's grid still the default", () => {
    expect(SECTION_VARIANTS.products.indexOf("ranked")).toBe(
      SECTION_VARIANTS.products.indexOf("strips") + 1
    )
    expect(variantOf("products", undefined)).toBe("grid")
    expect(variantOf("products", "ranked")).toBe("ranked")
  })

  it("asks its source for three to ten products, five by default", () => {
    expect(SHELF_LIMITS.ranked).toEqual({ counts: [3, 4, 5, 6, 7, 8, 9, 10], default: 5 })
    expect(shelfRankedCountOf(undefined)).toBe(5)
    expect(shelfRankedCountOf(2)).toBe(5)
    expect(shelfRankedCountOf(11)).toBe(5)
    expect(shelfRankedCountOf("7")).toBe(5)
    expect(shelfRankedCountOf(3)).toBe(3)
    expect(shelfRankedCountOf(10)).toBe(10)
    expect(shelfLimit({ variant: "ranked", limit: 12 })).toBe(5)
    expect(shelfLimit({ variant: "ranked", limit: 12, ranked_count: 8 })).toBe(8)
    // The shop's limit stays the grid's; another variant's count is not the ranked one
    expect(shelfLimit({ variant: "grid", limit: 12, ranked_count: 8 })).toBe(12)
    expect(shelfLimit({ variant: "strips", limit: 12, ranked_count: 8 })).toBe(5)
  })

  it("stands the first large by default, or all in one row", () => {
    expect(SHELF_RANKED_LAYOUTS).toEqual(["lead", "row"])
    expect(SHELF_RANKED_LAYOUT_DEFAULT).toBe("lead")
    expect(shelfRankedLayoutOf(undefined)).toBe("lead")
    expect(shelfRankedLayoutOf("row")).toBe("row")
    expect(shelfRankedLayoutOf("lead")).toBe("lead")
    expect(shelfRankedLayoutOf("grid")).toBe("lead")
    expect(shelfRankedLayoutOf(1)).toBe("lead")
  })
})
