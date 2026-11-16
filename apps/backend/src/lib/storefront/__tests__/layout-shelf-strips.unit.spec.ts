import path from "node:path"
import { hydrateShelf } from "../../../workflows/storefront/layout-hydrate-shelf"
import { layoutDocument } from "../layout"
import { FEATURED_PRODUCT_DEFAULTS, FEATURED_PRODUCT_SETTINGS } from "../sections/featured-product"
import {
  SHELF_LIMITS,
  SHELF_STRIPS_DEFAULTS,
  SHELF_STRIPS_SETTINGS,
  products,
  shelfLimit,
} from "../sections/products"
import { STRIP_GALLERY_DEFAULTS, STRIP_GALLERY_SETTINGS } from "../sections/strip-gallery"
import { STRIPS_HEIGHTS, STRIPS_LOOK_DEFAULTS, STRIPS_LOOK_SETTINGS } from "../sections/strips-look"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT = path.resolve(__dirname, "../../../../../../packages/types/src/store")

const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const rail = (more: Record<string, unknown> = {}) => ({
  id: "coksatanlar",
  type: "products",
  title: null,
  source: { kind: "best_sellers" },
  variant: "strips",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []
const home = (section: Record<string, unknown>) => layoutDocument.parse({ home: [section] }).home[0]
const LOOK = Object.keys(STRIPS_LOOK_SETTINGS) as (keyof typeof STRIPS_LOOK_SETTINGS)[]

describe("a product rail's strips variant (adr/0049 Ek 2026-11-16)", () => {
  it("fills five strips and the shared look's defaults on a rail switched to strips", () => {
    expect(home(rail())).toMatchObject({
      variant: "strips",
      strips_count: 5,
      strips_height: "medium",
      strips_slant: "medium",
      strips_line: "thin",
      strips_overlap: "off",
      strips_dim: "on",
      tabs: "auto",
    })
  })

  it("keeps the steps it was saved with", () => {
    const saved = {
      strips_count: 8,
      strips_height: "low",
      strips_slant: "steep",
      strips_line: "none",
      strips_overlap: "on",
      strips_dim: "off",
    }
    expect(home(rail(saved))).toMatchObject(saved)
  })

  it("refuses a count or a step off its list, and another variant's field", () => {
    for (const bad of [
      rail({ strips_count: 1 }),
      rail({ strips_count: 9 }),
      rail({ strips_height: "giant" }),
      rail({ strips_slant: "vertical" }),
      rail({ strips_overlap: true }),
    ]) {
      expect(issues({ home: [bad] })).toEqual(["storefront_layout.section_invalid"])
    }
    expect(issues({ home: [rail({ columns: 4 })] })).toHaveLength(1)
    // A grid holds no strips field
    expect(issues({ home: [rail({ variant: "grid", strips_count: 4 })] })).toHaveLength(1)
  })

  it("asks its source for its own count, not the shop's limit", () => {
    const of = (more: Record<string, unknown>) => products.parse(rail({ ...ALWAYS, ...more }))
    expect(shelfLimit(of({ limit: 12 }))).toBe(5)
    expect(shelfLimit(of({ limit: 12, strips_count: 3 }))).toBe(3)
  })

  it("prints its count and look to the storefront with the picked products", () => {
    const section = products.parse(rail({ ...ALWAYS, strips_count: 4, strips_overlap: "on" }))
    const picks = new Map([["coksatanlar", { product_ids: ["prod_1"], filled_with_newest: true }]])
    expect(hydrateShelf(section, picks, null)).toEqual({
      id: "coksatanlar",
      type: "products",
      variant: "strips",
      title: null,
      source: { kind: "best_sellers", days: 90 },
      limit: 12,
      more: null,
      card_variant: null,
      product_ids: ["prod_1"],
      filled_with_newest: true,
      strips_count: 4,
      strips_height: "medium",
      strips_slant: "medium",
      strips_line: "thin",
      strips_overlap: "on",
      strips_dim: "on",
    })
  })

  it("shares one look with the strip gallery and the featured product", () => {
    for (const name of LOOK) {
      expect(SHELF_STRIPS_SETTINGS[name]).toBe(STRIPS_LOOK_SETTINGS[name])
      expect(STRIP_GALLERY_SETTINGS[name]).toBe(STRIPS_LOOK_SETTINGS[name])
      expect(FEATURED_PRODUCT_SETTINGS[name]).toBe(STRIPS_LOOK_SETTINGS[name])
      expect(SHELF_STRIPS_DEFAULTS[name]).toBe(STRIPS_LOOK_DEFAULTS[name])
      expect(STRIP_GALLERY_DEFAULTS[name]).toBe(STRIPS_LOOK_DEFAULTS[name])
      expect(FEATURED_PRODUCT_DEFAULTS[name]).toBe(STRIPS_LOOK_DEFAULTS[name])
    }
    expect(SHELF_STRIPS_SETTINGS.strips_height).toBe(STRIPS_HEIGHTS)
    expect(STRIP_GALLERY_SETTINGS.height).toBe(STRIPS_HEIGHTS)
  })

  it("mirrors the contract's strips settings and count", () => {
    const strips = jest.requireActual<Record<string, unknown>>(`${CONTRACT}/section-strips.ts`)
    const shelf = jest.requireActual<Record<string, Record<string, unknown>>>(
      `${CONTRACT}/section-shelf.ts`
    )
    expect(STRIPS_LOOK_SETTINGS).toEqual(strips["STRIPS_LOOK_SETTINGS"])
    expect(STRIPS_LOOK_DEFAULTS).toEqual(strips["STRIPS_LOOK_DEFAULTS"])
    expect(STRIPS_HEIGHTS).toEqual(strips["STRIPS_HEIGHTS"])
    expect(SHELF_STRIPS_SETTINGS).toEqual(strips["SHELF_STRIPS_SETTINGS"])
    expect(SHELF_STRIPS_DEFAULTS).toEqual(strips["SHELF_STRIPS_DEFAULTS"])
    expect(SHELF_LIMITS.strips).toEqual(shelf["SHELF_LIMITS"]?.["strips"])
  })
})
