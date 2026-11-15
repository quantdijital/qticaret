import path from "node:path"
import { hydrateShelf } from "../../../workflows/storefront/layout-hydrate-shelf"
import { layoutDocument, readStoredLayout } from "../layout"
import { SHELF_LIMITS, listKey, products, shelfLimit, shelfSources } from "../sections/products"
import { SCROLLER_DEFAULTS, SCROLLER_SETTINGS } from "../sections/scroller"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT = path.resolve(__dirname, "../../../../../../packages/types/src/store")

// Every body section shows on every screen unless the shop picks one (bilesen-standardi §2)
const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const rail = (more: Record<string, unknown> = {}) => ({
  id: "yeniurunler",
  type: "products",
  title: null,
  source: { kind: "newest" },
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []
const home = (section: Record<string, unknown>) => layoutDocument.parse({ home: [section] }).home[0]

describe("a product rail's variants (adr/0049 Ek 2026-11-15)", () => {
  it("reads a rail saved before variants as today's grid, its columns as saved", () => {
    expect(home(rail({ columns: 4 }))).toEqual({
      ...rail(),
      ...ALWAYS,
      variant: "grid",
      columns: 4,
      columns_mobile: 2,
      tabs: "auto",
      limit: 12,
      more: null,
      card_variant: null,
    })
  })

  it("fills a carousel's scroller with the defaults, keeping each step it was saved with", () => {
    expect(home(rail({ variant: "carousel" }))).toMatchObject({ scroller: SCROLLER_DEFAULTS })
    expect(
      home(rail({ variant: "carousel", scroller: { arrows: "hover", loop: "on" } }))
    ).toMatchObject({ scroller: { ...SCROLLER_DEFAULTS, arrows: "hover", loop: "on" } })
  })

  it("refuses a step, a count or a variant off its list, and another variant's field", () => {
    for (const bad of [
      rail({ variant: "carousel", scroller: { desktop: "seven" } }),
      rail({ variant: "compact", rows: 4 }),
      rail({
        variant: "columns",
        per_list: 5,
        lists: [{ title: null, source: { kind: "newest" } }],
      }),
      rail({ variant: "spotlight" }),
    ]) {
      expect(issues({ home: [bad] })).toEqual(["storefront_layout.section_invalid"])
    }
    expect(issues({ home: [rail({ variant: "carousel", columns: 4 })] })).toHaveLength(1)
  })

  it("takes one or two more lists on a columns rail, each its own title and source", () => {
    const lists = [
      { title: "Yeni gelenler", source: { kind: "newest" } },
      { title: null, source: { kind: "category", category_id: "pcat_01" } },
    ]
    expect(home(rail({ variant: "columns", lists }))).toMatchObject({ per_list: 4, lists })
    expect(issues({ home: [rail({ variant: "columns", lists: [] })] })).not.toEqual([])
    expect(
      issues({ home: [rail({ variant: "columns", lists: [...lists, ...lists] })] })
    ).not.toEqual([])
  })

  it("reads a stored variant off the list as a grid, dropping that variant's fields", () => {
    const doc = readStoredLayout({
      home: [rail({ ...ALWAYS, variant: "mosaic", columns: 5, tiles: 3 })],
    })
    expect(doc.home[0]).toMatchObject({ type: "products", variant: "grid", columns: 5 })
    expect(doc.home[0]).not.toHaveProperty("tiles")
  })

  it("asks each source for as many as the variant shows", () => {
    const of = (more: Record<string, unknown>) => products.parse(rail({ ...ALWAYS, ...more }))
    expect(shelfLimit(of({ limit: 9 }))).toBe(9)
    expect(shelfLimit(of({ variant: "carousel", limit: 9 }))).toBe(9)
    expect(shelfLimit(of({ variant: "featured", limit: 9 }))).toBe(SHELF_LIMITS.featured)
    expect(shelfLimit(of({ variant: "compact", rows: 3 }))).toBe(9)
    const columns = of({
      variant: "columns",
      per_list: 3,
      lists: [{ title: null, source: { kind: "on_sale" } }],
    })
    expect(shelfLimit(columns)).toBe(3)
    expect(shelfSources(columns)).toEqual([
      { key: "yeniurunler", source: { kind: "newest" } },
      { key: listKey("yeniurunler", 0), source: { kind: "on_sale" } },
    ])
  })

  it("prints each variant's own fields and each list's picked products", () => {
    const columns = products.parse(
      rail({
        ...ALWAYS,
        variant: "columns",
        lists: [{ title: "İndirim", source: { kind: "on_sale" } }],
      })
    )
    const picks = new Map([
      [listKey("yeniurunler", 0), { product_ids: ["prod_1"], filled_with_newest: false }],
    ])
    expect(hydrateShelf(columns, picks, null)).toMatchObject({
      variant: "columns",
      per_list: 4,
      lists: [{ title: "İndirim", source: { kind: "on_sale" }, product_ids: ["prod_1"] }],
    })
    expect(hydrateShelf(products.parse(rail(ALWAYS)), undefined, null)).toMatchObject({
      variant: "grid",
      columns: 3,
    })
  })

  it("mirrors the contract's scroller and counts", () => {
    const scroller = jest.requireActual<Record<string, unknown>>(`${CONTRACT}/section-scroller.ts`)
    const shelf = jest.requireActual<Record<string, unknown>>(`${CONTRACT}/section-shelf.ts`)
    expect(SCROLLER_SETTINGS).toEqual(scroller["SCROLLER_SETTINGS"])
    expect(SCROLLER_DEFAULTS).toEqual(scroller["SCROLLER_DEFAULTS"])
    expect(SHELF_LIMITS).toEqual(shelf["SHELF_LIMITS"])
  })
})
