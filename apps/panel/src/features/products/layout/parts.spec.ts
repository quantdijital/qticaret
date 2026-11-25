import { describe, expect, it } from "vitest"
import { DEFAULT_LAYOUT, isLocked, layoutOf, partOfTarget, sameLayout } from "./parts"

describe("product page layout", () => {
  it("is the default with nothing saved, or something unreadable", () => {
    expect(layoutOf(undefined)).toEqual(DEFAULT_LAYOUT)
    expect(layoutOf({ main: [], side: [], hidden: [] })).toEqual(DEFAULT_LAYOUT)
    expect(layoutOf("nonsense")).toEqual(DEFAULT_LAYOUT)
  })

  it("keeps the saved order, drops keys it no longer knows and puts a new part at its default place", () => {
    const rest = DEFAULT_LAYOUT.main.filter((key) => !["general", "seo", "media"].includes(key))
    const layout = layoutOf({
      // "media" missing (a part added since), "gone" removed since, "seo" twice
      main: ["general", "seo", "gone", ...rest, "seo"],
      side: ["advisor", "summary"],
      hidden: [],
    })
    expect(layout.main.slice(0, 5)).toEqual(["general", "seo", "variants", "media", "description"])
    expect(new Set(layout.main)).toEqual(new Set(DEFAULT_LAYOUT.main))
    expect(layout.main).toHaveLength(DEFAULT_LAYOUT.main.length)
    // A missing card follows the one it comes right after by default (the advisor)
    expect(layout.side).toEqual(["advisor", "organize", "catalog", "shipping", "summary"])
  })

  it("never hides a locked part, nor a key it does not know", () => {
    const layout = layoutOf({ main: [], side: [], hidden: ["general", "faq", "advisor", "x"] })
    expect(layout.hidden).toEqual(["faq"])
    expect(isLocked("general")).toBe(true)
    expect(isLocked("variants")).toBe(true)
    expect(isLocked("advisor")).toBe(true)
    expect(isLocked("seo")).toBe(false)
  })

  it("finds the part an advisor target lands in", () => {
    expect(partOfTarget("product-seo")).toBe("seo")
    expect(partOfTarget("product-media-alt")).toBe("media")
    expect(partOfTarget("product-variant-codes")).toBe("variants")
    expect(partOfTarget("product-organize")).toBe("organize")
    expect(partOfTarget("somewhere-else")).toBeUndefined()
  })

  it("compares layouts by what they show", () => {
    expect(sameLayout(DEFAULT_LAYOUT, { ...DEFAULT_LAYOUT, hidden: [] })).toBe(true)
    expect(sameLayout(DEFAULT_LAYOUT, { ...DEFAULT_LAYOUT, hidden: ["faq"] })).toBe(false)
    expect(
      sameLayout(
        { ...DEFAULT_LAYOUT, hidden: ["faq", "seo"] },
        { ...DEFAULT_LAYOUT, hidden: ["seo", "faq"] }
      )
    ).toBe(true)
  })
})
