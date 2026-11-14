import { describe, expect, it } from "vitest"
import type { StoreMainSections } from "@qticaret/types"
import { categoryMainOf, footerBarOf, headerBarOf, productMainOf } from "../main-sections"

const MAIN: StoreMainSections = {
  header_bar: { id: "mainheader", type: "header_bar", variant: "centered", sticky: false },
  footer_bar: { id: "mainfooter", type: "footer_bar", variant: "ledger" },
  product_main: {
    id: "mainproduct",
    type: "product_main",
    variant: "standard",
    look: { space_outer: null, space_inner: null, ground: null, align: null, width: "narrow" },
  },
  category_main: { id: "maincategory", type: "category_main", variant: "standard", by_variant: {} },
}

describe("the main sections' views (adr/0049 Ek 2026-11-14 §5, §7)", () => {
  it("takes the design's header bar over the theme's header", () => {
    expect(headerBarOf(MAIN, { header: { layout: "left", sticky: true } })).toEqual({
      id: "mainheader",
      variant: "centered",
      sticky: false,
    })
  })

  it("reads the theme's header from a backend before the main sections", () => {
    expect(headerBarOf(undefined, { header: { layout: "centered", sticky: false } })).toEqual({
      id: "mainheader",
      variant: "centered",
      sticky: false,
    })
    expect(headerBarOf(undefined, { header: { layout: "left", sticky: true } })).toMatchObject({
      variant: "standard",
      sticky: true,
    })
  })

  it("reads a variant this build does not know as the default", () => {
    const newer = {
      ...MAIN,
      header_bar: { ...MAIN.header_bar, variant: "catalog" },
      footer_bar: { ...MAIN.footer_bar, variant: "dark_rich" },
    } as unknown as StoreMainSections
    expect(headerBarOf(newer, { header: { layout: "left", sticky: true } }).variant).toBe(
      "standard"
    )
    expect(footerBarOf(newer).variant).toBe("ledger")
  })

  it("gives the product's block the steps the shop set, and none when it set none", () => {
    expect(productMainOf(MAIN)).toEqual({
      id: "mainproduct",
      variant: "standard",
      look: { width: "narrow" },
    })
    expect(categoryMainOf(MAIN)).toEqual({ id: "maincategory", variant: "standard" })
    expect(productMainOf(undefined)).toEqual({ id: "mainproduct", variant: "standard" })
  })
})
