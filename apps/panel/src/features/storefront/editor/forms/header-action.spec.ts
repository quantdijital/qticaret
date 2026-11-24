import { describe, expect, it } from "vitest"
import type { HeaderBarSection } from "@/features/storefront/api/layout"
import { HEADER_CATALOG_DEFAULTS, switchVariant } from "@/features/storefront/layout/variants"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { headerSetIn } from "./header-marks"
import { previewField } from "./preview-fields"

const standard: HeaderBarSection = {
  id: "mainheader",
  type: "header_bar",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "standard",
  sticky: true,
  menu_images: "submenus",
  search_style: "field",
}

const ACTION = { kind: "url", url: "https://example.com/turlar", label: "Rezervasyon" } as const

/** Every header's action button: the catalog header's highlighted link, now on each variant. */
describe("the header's action button", () => {
  it("is carried over a variant switch once written, and left out while not", () => {
    const set = { ...standard, highlight_link: ACTION } as HeaderBarSection
    const catalog = switchVariant(set, "catalog")
    expect(catalog).toEqual({
      ...standard,
      ...HEADER_CATALOG_DEFAULTS,
      variant: "catalog",
      highlight_link: ACTION,
    })
    expect(switchVariant(catalog, "centered")).toEqual({
      ...standard,
      variant: "centered",
      highlight_link: ACTION,
    })
    // None written: the switch is as before it
    expect(switchVariant(switchVariant(standard, "catalog"), "standard")).toEqual(standard)
  })

  it("names a written link without words on every variant", () => {
    for (const variant of ["standard", "centered"] as const) {
      const section = {
        ...standard,
        variant,
        highlight_link: { ...ACTION, label: " " },
      } as HeaderBarSection
      expect(sectionProblems(section)["highlight_link"]).toBe("linkLabel")
    }
    expect(sectionProblems(standard)["highlight_link"]).toBeUndefined()
  })

  it("marks the menu group once written, and points the preview at its field", () => {
    expect(headerSetIn(standard, "menu")).toBe(0)
    expect(headerSetIn({ ...standard, highlight_link: ACTION }, "menu")).toBe(1)
    expect(previewField(standard, "highlight_link")).toEqual({
      target: "mainheader-header-highlight_link",
      group: "menu",
    })
  })
})
