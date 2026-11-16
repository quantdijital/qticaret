import path from "node:path"
import { hydrateShelf } from "../../../workflows/storefront/layout-hydrate-shelf"
import { layoutDocument } from "../layout"
import {
  SHELF_LIMITS,
  SHELF_STAGE_DEFAULTS,
  SHELF_STAGE_SETTINGS,
  products,
  shelfLimit,
} from "../sections/products"
import { SECTION_VARIANTS } from "../sections/variants"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT = path.resolve(__dirname, "../../../../../../packages/types/src/store")

const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const rail = (more: Record<string, unknown> = {}) => ({
  id: "sahneraf",
  type: "products",
  title: null,
  source: { kind: "best_sellers" },
  variant: "stage_list",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []
const home = (section: Record<string, unknown>) => layoutDocument.parse({ home: [section] }).home[0]

describe("a product rail's stage list variant (adr/0049 Ek 2026-11-16)", () => {
  it("fills four products and its defaults on a rail switched to a stage list", () => {
    expect(home(rail())).toMatchObject({
      variant: "stage_list",
      stage_count: 4,
      stage_side: "start",
      stage_ground: "stage",
      stage_follow: "on",
      tabs: "auto",
    })
  })

  it("keeps the steps it was saved with", () => {
    const saved = {
      stage_count: 6,
      stage_side: "end",
      stage_ground: "well",
      stage_follow: "off",
    }
    expect(home(rail(saved))).toMatchObject(saved)
  })

  it("refuses a count or a step off its list, and another variant's field", () => {
    for (const bad of [
      rail({ stage_count: 2 }),
      rail({ stage_count: 7 }),
      rail({ stage_side: "top" }),
      rail({ stage_ground: "primary" }),
      rail({ stage_follow: true }),
    ]) {
      expect(issues({ home: [bad] })).toEqual(["storefront_layout.section_invalid"])
    }
    expect(issues({ home: [rail({ strips_count: 4 })] })).toHaveLength(1)
    // A grid holds no stage field
    expect(issues({ home: [rail({ variant: "grid", stage_count: 4 })] })).toHaveLength(1)
  })

  it("asks its source for its own count, not the shop's limit", () => {
    const of = (more: Record<string, unknown>) => products.parse(rail({ ...ALWAYS, ...more }))
    expect(shelfLimit(of({ limit: 12 }))).toBe(4)
    expect(shelfLimit(of({ limit: 12, stage_count: 3 }))).toBe(3)
  })

  it("prints its count and settings to the storefront with the picked products", () => {
    const section = products.parse(rail({ ...ALWAYS, stage_count: 5, stage_side: "end" }))
    const picks = new Map([["sahneraf", { product_ids: ["prod_1"], filled_with_newest: true }]])
    expect(hydrateShelf(section, picks, null)).toEqual({
      id: "sahneraf",
      type: "products",
      variant: "stage_list",
      title: null,
      source: { kind: "best_sellers", days: 90 },
      limit: 12,
      more: null,
      card_variant: null,
      product_ids: ["prod_1"],
      filled_with_newest: true,
      stage_count: 5,
      stage_side: "end",
      stage_ground: "stage",
      stage_follow: "on",
    })
  })

  it("mirrors the contract's stage settings, count and variant list", () => {
    const shelf = jest.requireActual<Record<string, Record<string, unknown>>>(
      `${CONTRACT}/section-shelf.ts`
    )
    const variants = jest.requireActual<Record<string, Record<string, unknown>>>(
      `${CONTRACT}/section-variants.ts`
    )
    expect(SHELF_STAGE_SETTINGS).toEqual(shelf["SHELF_STAGE_SETTINGS"])
    expect(SHELF_STAGE_DEFAULTS).toEqual(shelf["SHELF_STAGE_DEFAULTS"])
    expect(SHELF_LIMITS.stage_list).toEqual(shelf["SHELF_LIMITS"]?.["stage_list"])
    expect(SECTION_VARIANTS.products).toEqual(variants["SECTION_VARIANTS"]?.["products"])
  })
})
