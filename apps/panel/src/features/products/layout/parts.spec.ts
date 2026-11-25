import { describe, expect, it } from "vitest"
import {
  DEFAULT_LAYOUT,
  isLocked,
  layoutOf,
  partOfTarget,
  sameLayout,
  tabOfTarget,
  targetsOf,
} from "./parts"

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
    expect(layout.main.slice(0, 4)).toEqual(["general", "media", "seo", "description"])
    expect(new Set(layout.main)).toEqual(new Set(DEFAULT_LAYOUT.main))
    expect(layout.main).toHaveLength(DEFAULT_LAYOUT.main.length)
    // A missing card follows the one it comes right after by default (the advisor)
    expect(layout.side).toEqual(["advisor", "organize", "summary"])
  })

  it("reads a layout saved before the data card: its cards became tabs, still hidden", () => {
    const layout = layoutOf({
      main: ["general", "variants", "media", "description", "attributes", "addons", "seo"],
      side: ["summary", "advisor", "organize", "catalog", "shipping"],
      hidden: ["attributes", "shipping", "addons", "variants"],
      open: ["attributes", "seo"],
    })
    // The data card takes its default place, after the description
    expect(layout.main.slice(0, 4)).toEqual(["general", "media", "description", "data"])
    expect(layout.side).toEqual(["summary", "advisor", "organize"])
    // A hidden card is a hidden tab; the variants are never hidden, add-ons live in Gelişmiş
    expect(layout.hidden).toEqual(["attributes", "shipping"])
    expect(layout.open).toEqual(["seo"])
  })

  it("never hides a locked part, nor a key it does not know", () => {
    const layout = layoutOf({
      main: [],
      side: [],
      hidden: ["general", "faq", "advisor", "data", "pricing", "stock", "x"],
    })
    expect(layout.hidden).toEqual(["faq", "stock"])
    expect(isLocked("general")).toBe(true)
    expect(isLocked("data")).toBe(true)
    expect(isLocked("variants")).toBe(true)
    expect(isLocked("advisor")).toBe(true)
    expect(isLocked("seo")).toBe(false)
    expect(isLocked("shipping")).toBe(false)
  })

  it("finds the part an advisor target lands in, a tab by the product's type", () => {
    expect(partOfTarget("product-seo")).toBe("seo")
    expect(partOfTarget("product-media-alt")).toBe("media")
    expect(partOfTarget("product-organize")).toBe("organize")
    expect(partOfTarget("product-shipping")).toBe("shipping")
    expect(partOfTarget("product-price-history")).toBe("advanced")
    expect(partOfTarget("product-variant-codes")).toBe("variants")
    expect(partOfTarget("product-variant-codes", true)).toBe("stock")
    expect(tabOfTarget("product-variants", true)).toBe("pricing")
    expect(tabOfTarget("product-variants", false)).toBe("variants")
    expect(partOfTarget("somewhere-else")).toBeUndefined()
  })

  it("counts a simple product's price and codes in its Genel and Stok tabs", () => {
    expect(targetsOf("pricing", true)).toContain("product-variants")
    expect(targetsOf("stock", true)).toContain("product-variant-codes")
    expect(targetsOf("variants", true)).toEqual([])
    expect(targetsOf("variants")).toContain("product-variants")
    expect(targetsOf("data")).toContain("product-shipping")
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
