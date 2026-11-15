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
    look: {
      space_outer: null,
      space_below: null,
      space_inner: null,
      ground: null,
      align: null,
      width: "narrow",
    },
  },
  category_main: { id: "maincategory", type: "category_main", variant: "standard", by_variant: {} },
}

describe("the main sections' views (adr/0049 Ek 2026-11-14 §5, §7)", () => {
  it("takes the design's header bar over the theme's header", () => {
    expect(headerBarOf(MAIN, { header: { layout: "left", sticky: true } })).toEqual({
      id: "mainheader",
      variant: "centered",
      sticky: false,
      menuImages: "submenus",
    })
  })

  it("reads the menus' pictures as saved, and as drawn before when absent or off the list (adr/0049 Ek 2026-11-15)", () => {
    const theme = { header: { layout: "left", sticky: true } } as const
    for (const step of ["all", "submenus", "off"] as const) {
      const saved = { ...MAIN, header_bar: { ...MAIN.header_bar, menu_images: step } }
      expect(headerBarOf(saved, theme).menuImages).toBe(step)
    }
    // An older backend (or a preset fixture not run through the backend's defaults) prints none
    expect(headerBarOf(MAIN, theme).menuImages).toBe("submenus")
    expect(headerBarOf(undefined, theme).menuImages).toBe("submenus")
    // A development draft's switch from before the steps
    const stray = { ...MAIN, header_bar: { ...MAIN.header_bar, menu_images: true as never } }
    expect(headerBarOf(stray, theme).menuImages).toBe("submenus")
  })

  it("reads the theme's header from a backend before the main sections", () => {
    expect(headerBarOf(undefined, { header: { layout: "centered", sticky: false } })).toEqual({
      id: "mainheader",
      variant: "centered",
      sticky: false,
      menuImages: "submenus",
    })
    expect(headerBarOf(undefined, { header: { layout: "left", sticky: true } })).toMatchObject({
      variant: "standard",
      sticky: true,
    })
  })

  it("reads a variant this build does not know as the default", () => {
    const newer = {
      ...MAIN,
      header_bar: { ...MAIN.header_bar, variant: "shrinking" },
      footer_bar: { ...MAIN.footer_bar, variant: "dark_rich" },
    } as unknown as StoreMainSections
    expect(headerBarOf(newer, { header: { layout: "left", sticky: true } }).variant).toBe(
      "standard"
    )
    expect(footerBarOf(newer, (key) => key).variant).toBe("ledger")
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

  it("gives the catalog header its settings, the link named and the tree only with its button", () => {
    const t = (key: string) => (key === "menu.system.sale" ? "Kampanyalar" : key)
    const tree = [{ label: "Bıçaklar", path: "/bicaklar", image: null, children: [] }]
    const catalog = {
      ...MAIN,
      header_bar: {
        ...MAIN.header_bar,
        variant: "catalog",
        catalog: {
          search_placeholder: "Ürün ya da kod",
          search_label: true,
          account_text: false,
          cart_total: true,
          highlight_link: { label: null, kind: "system", target: "sale", path: null },
          utility_bar: true,
          phone: false,
          categories_button: true,
          menu_ground: "primary",
        },
      },
    } satisfies StoreMainSections
    const view = headerBarOf(
      catalog,
      { header: { layout: "left", sticky: true } },
      {
        t,
        tree: () => tree,
      }
    )
    expect(view.catalog).toEqual({
      searchPlaceholder: "Ürün ya da kod",
      searchLabel: true,
      accountText: false,
      cartTotal: true,
      highlight: { label: "Kampanyalar", path: "/kampanyalar" },
      utilityBar: true,
      phone: false,
      categories: tree,
      menuGround: "primary",
      // An answer without the layout choices (an older backend): today's drawing
      toolsPlace: "bar",
      topLinksPlace: "strip",
      searchWidth: "wide",
      // Nor a strip note (Ek 2026-11-15): none
      stripNote: null,
    })
    const laid = (set: Record<string, unknown>) =>
      headerBarOf(
        {
          ...catalog,
          header_bar: { ...catalog.header_bar, catalog: { ...catalog.header_bar.catalog, ...set } },
        },
        { header: { layout: "left", sticky: true } },
        { t, tree: () => tree }
      ).catalog
    expect(laid({ tools_place: "row", top_links: "bar", search_width: "narrow" })).toMatchObject({
      toolsPlace: "row",
      topLinksPlace: "bar",
      searchWidth: "narrow",
    })
    // A newer build's step reads as today's
    expect(laid({ tools_place: "floating", top_links: 2, search_width: null })).toMatchObject({
      toolsPlace: "bar",
      topLinksPlace: "strip",
      searchWidth: "wide",
    })
    const off = {
      ...catalog,
      header_bar: {
        ...catalog.header_bar,
        catalog: { ...catalog.header_bar.catalog, categories_button: false },
      },
    }
    const parts = { t, tree: () => tree }
    expect(
      headerBarOf(off, { header: { layout: "left", sticky: true } }, parts).catalog?.categories
    ).toEqual([])
    // Today's bar carries none
    expect(
      headerBarOf(MAIN, { header: { layout: "left", sticky: true } }, parts)
    ).not.toHaveProperty("catalog")
  })
})
