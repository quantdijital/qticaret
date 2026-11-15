import { describe, expect, it } from "vitest"
import { SCROLLER_DEFAULTS } from "@qticaret/types"
import type { ProductsSection } from "@/features/storefront/api/layout"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { sectionFields } from "./field-registry"

const grid = newHomeSection("products", "rafyeni001") as ProductsSection
const keys = (section: ProductsSection) =>
  sectionFields(section, "home").map((field) => `${field.group}:${field.key}`)

/** adr/0049 Ek 2026-11-15: a product list's fields in the settings search, as its variant shows them. */
describe("a product list's fields for the settings search", () => {
  it("puts the variant first in Diziliş, with a grid's cards in a row and its card", () => {
    expect(keys(grid).slice(0, 3)).toEqual([
      "layout:variant",
      "layout:columns",
      "layout:card_variant",
    ])
  })

  it("adds a carousel's scroller: what is in view and the arrows open, the rest closed", () => {
    const carousel = switchVariant(grid, "carousel")
    const found = keys(carousel)
    expect(found).toContain("scroll:scroller.arrows")
    expect(found).toContain("look:scroller.loop")
    expect(found).not.toContain("layout:columns")
    // The speed only while it turns by itself
    expect(found).not.toContain("look:scroller.speed")
    expect(
      keys({ ...carousel, scroller: { ...SCROLLER_DEFAULTS, autoplay: "on", arrows: "hidden" } })
    ).toEqual(expect.arrayContaining(["look:scroller.speed"]))
  })

  it("names a compact list's rows and a columns list's count, never their card", () => {
    expect(keys(switchVariant(grid, "compact"))).toContain("layout:rows")
    const columns = keys(switchVariant(grid, "columns"))
    expect(columns).toContain("layout:per_list")
    expect(columns).not.toContain("layout:card_variant")
  })
})
