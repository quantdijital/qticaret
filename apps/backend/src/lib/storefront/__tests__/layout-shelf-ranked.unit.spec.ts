import path from "node:path"
import { hydrateShelf } from "../../../workflows/storefront/layout-hydrate-shelf"
import { layoutDocument } from "../layout"
import {
  SHELF_LIMITS,
  SHELF_RANKED_LAYOUTS,
  SHELF_RANKED_LAYOUT_DEFAULT,
  products,
  shelfLimit,
} from "../sections/products"
import { SECTION_VARIANTS } from "../sections/variants"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT = path.resolve(__dirname, "../../../../../../packages/types/src/store")

const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const rail = (more: Record<string, unknown> = {}) => ({
  id: "indirimler",
  type: "products",
  title: null,
  source: { kind: "on_sale" },
  variant: "ranked",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []
const home = (section: Record<string, unknown>) => layoutDocument.parse({ home: [section] }).home[0]

describe("a product rail's ranked variant (adr/0049 Ek 2026-11-16)", () => {
  it("comes after strips on the rail's list", () => {
    expect(SECTION_VARIANTS.products.indexOf("ranked")).toBe(
      SECTION_VARIANTS.products.indexOf("strips") + 1
    )
  })

  it("fills five places, the first large, on a rail switched to ranked", () => {
    expect(home(rail())).toMatchObject({
      variant: "ranked",
      ranked_count: 5,
      ranked_layout: "lead",
      tabs: "auto",
    })
  })

  it("keeps the count and layout it was saved with", () => {
    expect(home(rail({ ranked_count: 10, ranked_layout: "row" }))).toMatchObject({
      ranked_count: 10,
      ranked_layout: "row",
    })
    expect(home(rail({ ranked_count: 3 }))).toMatchObject({ ranked_count: 3 })
  })

  it("refuses a count or a layout off its list, and another variant's field", () => {
    for (const bad of [
      rail({ ranked_count: 2 }),
      rail({ ranked_count: 11 }),
      rail({ ranked_count: "5" }),
      rail({ ranked_layout: "grid" }),
      rail({ ranked_layout: true }),
    ]) {
      expect(issues({ home: [bad] })).toEqual(["storefront_layout.section_invalid"])
    }
    expect(issues({ home: [rail({ strips_count: 4 })] })).toHaveLength(1)
    // A grid holds no ranked field
    expect(issues({ home: [rail({ variant: "grid", ranked_count: 4 })] })).toHaveLength(1)
  })

  it("asks its source for its own count, not the shop's limit", () => {
    const of = (more: Record<string, unknown>) => products.parse(rail({ ...ALWAYS, ...more }))
    expect(shelfLimit(of({ limit: 12 }))).toBe(5)
    expect(shelfLimit(of({ limit: 12, ranked_count: 9 }))).toBe(9)
  })

  it("prints its count and layout to the storefront with the picked products", () => {
    const section = products.parse(rail({ ...ALWAYS, ranked_count: 7, ranked_layout: "row" }))
    const picks = new Map([["indirimler", { product_ids: ["prod_1"], filled_with_newest: false }]])
    expect(hydrateShelf(section, picks, null)).toEqual({
      id: "indirimler",
      type: "products",
      variant: "ranked",
      title: null,
      source: { kind: "on_sale" },
      limit: 12,
      more: null,
      card_variant: null,
      product_ids: ["prod_1"],
      filled_with_newest: false,
      ranked_count: 7,
      ranked_layout: "row",
    })
  })

  it("mirrors the contract's ranked count and layouts", () => {
    const shelf = jest.requireActual<Record<string, unknown>>(`${CONTRACT}/section-shelf.ts`)
    expect(SHELF_LIMITS.ranked).toEqual(
      (shelf["SHELF_LIMITS"] as Record<string, unknown> | undefined)?.["ranked"]
    )
    expect(SHELF_RANKED_LAYOUTS).toEqual(shelf["SHELF_RANKED_LAYOUTS"])
    expect(SHELF_RANKED_LAYOUT_DEFAULT).toBe(shelf["SHELF_RANKED_LAYOUT_DEFAULT"])
  })
})
