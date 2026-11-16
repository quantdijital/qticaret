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
  it("keeps the variant in its own Biçim, then a grid's cards in a row (wide, phone) and its card in Diziliş", () => {
    expect(keys(grid)).toContain("variant:variant")
    expect(keys(grid).filter((key) => key.startsWith("layout:"))).toEqual([
      "layout:columns",
      "layout:columns_mobile",
      "layout:card_variant",
      "layout:tabs",
    ])
    // Its count is the content's (denetim O2), and the columns carry their term
    expect(keys(grid)).toContain("content:limit")
    expect(sectionFields(grid, "home").find((field) => field.key === "columns")?.term).toBe(
      "storefront.editor.fields.columnsTerm"
    )
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
    // A columns rail never joins tabs (bilesen-denetimi (b) 2)
    expect(columns).not.toContain("layout:tabs")
    expect(keys(switchVariant(grid, "carousel"))).toContain("layout:tabs")
  })

  it("names a strips list's count and look in Diziliş, never its card (Ek 2026-11-16)", () => {
    const strips = switchVariant(grid, "strips")
    // The variant in Stil › Biçim, the count and look in Stil › Diziliş (docs/18 §7.1)
    expect(keys(strips)).toContain("variant:variant")
    expect(keys(strips).filter((key) => key.startsWith("layout:"))).toEqual([
      "layout:strips_count",
      "layout:strips_height",
      "layout:strips_slant",
      "layout:strips_line",
      "layout:strips_overlap",
      "layout:strips_dim",
      "layout:tabs",
    ])
    // The steps are found by their everyday names too
    expect(sectionFields(strips, "home").find((field) => field.key === "strips_height")).toEqual(
      expect.objectContaining({
        options: ["low", "medium", "high"].map(
          (step) => `storefront.editor.stripGallery.height.${step}`
        ),
      })
    )
    for (const key of keys(grid)) expect(key).not.toMatch(/strips_/)
  })

  it("names a stage list's count, side, ground and follow in Diziliş, never its card (Ek 2026-11-16)", () => {
    const stage = switchVariant(grid, "stage_list")
    expect(keys(stage)).toContain("variant:variant")
    expect(keys(stage).filter((key) => key.startsWith("layout:"))).toEqual([
      "layout:stage_count",
      "layout:stage_side",
      "layout:stage_ground",
      "layout:stage_follow",
      "layout:tabs",
    ])
    expect(sectionFields(stage, "home").find((field) => field.key === "stage_ground")).toEqual(
      expect.objectContaining({
        label: "storefront.editor.shelf.stage.stage_ground.label",
        options: ["stage", "well"].map(
          (step) => `storefront.editor.shelf.stage.stage_ground.steps.${step}`
        ),
      })
    )
    for (const key of keys(grid)) expect(key).not.toMatch(/stage_/)
  })
})
