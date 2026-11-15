import path from "node:path"
import { layoutDocument } from "../layout"
import { SHELF_PHONE_COLUMNS, SHELF_PHONE_DEFAULT } from "../layout-fields"
import { CATEGORY_CARD_DEFAULTS, CATEGORY_CARD_SETTINGS } from "../sections/categories"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const contract = (file: string) =>
  jest.requireActual<Record<string, unknown>>(
    path.resolve(__dirname, `../../../../../../packages/types/src/store/${file}`)
  )

const rail = (more: Record<string, unknown> = {}) => ({
  id: "raf0000001",
  type: "products",
  title: null,
  source: { kind: "newest" },
  ...more,
})
const related = (more: Record<string, unknown> = {}) => ({
  id: "benzer0001",
  type: "related_products",
  title: null,
  source: { kind: "same_category" },
  ...more,
})
const linked = (more: Record<string, unknown> = {}) => ({
  id: "kategori01",
  type: "categories",
  title: null,
  variant: "linked",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("cards in a row on a phone (bilesen-denetimi (b) 3)", () => {
  it("reads grids saved before it as they were drawn: two cards, one linked category card", () => {
    const doc = layoutDocument.parse({
      home: [rail(), linked()],
      product: [related()],
    })

    expect(doc.home[0]).toMatchObject({ variant: "grid", columns: 3, columns_mobile: 2 })
    expect(doc.home[1]).toMatchObject({ variant: "linked", columns_mobile: 1 })
    expect(doc.product[0]).toMatchObject({ columns: 3, columns_mobile: 2 })
  })

  it("keeps the shop's count as saved, and only on a grid rail", () => {
    const doc = layoutDocument.parse({
      home: [rail({ columns_mobile: 1 }), linked({ columns_mobile: 2 })],
      product: [related({ columns_mobile: 1 })],
    })

    expect(doc.home[0]).toMatchObject({ columns_mobile: 1 })
    expect(doc.home[1]).toMatchObject({ columns_mobile: 2 })
    expect(doc.product[0]).toMatchObject({ columns_mobile: 1 })
    expect(issues({ home: [rail({ variant: "featured", columns_mobile: 1 })] })).not.toEqual([])
  })

  it("refuses a count off its list", () => {
    expect(issues({ home: [rail({ columns_mobile: 3 })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ product: [related({ columns_mobile: "2" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [linked({ columns_mobile: 0 })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("mirrors the contract's lists: a count goes there first", () => {
    const shelf = contract("section-shelf.ts")
    expect(SHELF_PHONE_COLUMNS).toEqual(shelf["SHELF_PHONE_COLUMNS"])
    expect(SHELF_PHONE_DEFAULT).toEqual(shelf["SHELF_PHONE_DEFAULT"])
    const cards = contract("section-categories.ts")
    expect(CATEGORY_CARD_SETTINGS).toEqual(cards["CATEGORY_CARD_SETTINGS"])
    expect(CATEGORY_CARD_DEFAULTS).toEqual(cards["CATEGORY_CARD_DEFAULTS"])
  })
})
