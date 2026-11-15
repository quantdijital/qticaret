import { describe, expect, it } from "vitest"
import { bandRanges, bandsRise } from "../store/section-catalog.js"
import { SECTION_VARIANTS, defaultVariant, variantOf } from "../store/section-variants.js"

describe("the catalogue home page's parts", () => {
  it("draws today's opening by default, the category list on request", () => {
    expect(SECTION_VARIANTS.hero).toEqual(["standard", "category_list"])
    expect(defaultVariant("hero")).toBe("standard")
    expect(variantOf("hero", "category_list")).toBe("category_list")
    expect(variantOf("hero", "bento")).toBe("standard")
  })

  it("ranges each band from just above the one before's bound to its own, never overlapping", () => {
    expect(bandRanges([{ max: 500 }, { max: 1000 }, { max: null }])).toEqual([
      { min: null, max: 500 },
      { min: 501, max: 1000 },
      { min: 1001, max: null },
    ])
  })

  it("takes rising bands, an open one only last", () => {
    expect(bandsRise([{ max: 500 }, { max: 1000 }, { max: null }])).toBe(true)
    expect(bandsRise([{ max: 500 }, { max: 2500 }])).toBe(true)
    expect(bandsRise([{ max: 1000 }, { max: 500 }])).toBe(false)
    expect(bandsRise([{ max: 500 }, { max: 500 }])).toBe(false)
    expect(bandsRise([{ max: null }, { max: 500 }])).toBe(false)
    expect(bandsRise([{ max: 500 }, { max: null }, { max: null }])).toBe(false)
  })
})
