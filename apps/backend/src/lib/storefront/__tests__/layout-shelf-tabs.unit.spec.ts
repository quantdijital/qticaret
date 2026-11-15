import path from "node:path"
import { hydrateShelf } from "../../../workflows/storefront/layout-hydrate-shelf"
import { layoutDocument } from "../layout"
import { SHELF_TABS, SHELF_TABS_DEFAULT, products } from "../sections/products"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT = path.resolve(__dirname, "../../../../../../packages/types/src/store")

const rail = (more: Record<string, unknown> = {}) => ({
  id: "yeniurunler",
  type: "products",
  title: null,
  source: { kind: "newest" },
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("a product rail's tabs setting (bilesen-denetimi (b) 2)", () => {
  it("reads a rail saved before it as joining its neighbours, as it was drawn", () => {
    const doc = layoutDocument.parse({ home: [rail(), rail({ id: "indirimdek" })] })
    expect(doc.home[0]).toMatchObject({ tabs: "auto" })
    expect(doc.home[1]).toMatchObject({ tabs: "auto" })
  })

  it("keeps a rail set apart as saved, on every variant, and across a save", () => {
    const doc = layoutDocument.parse({
      home: [rail({ tabs: "off" }), rail({ id: "kayanraf01", variant: "carousel", tabs: "off" })],
    })
    expect(doc.home[0]).toMatchObject({ tabs: "off" })
    expect(doc.home[1]).toMatchObject({ tabs: "off" })
    expect(layoutDocument.parse(doc).home[0]).toMatchObject({ tabs: "off" })
  })

  it("refuses a step off its list", () => {
    expect(issues({ home: [rail({ tabs: "on" })] })).toEqual(["storefront_layout.section_invalid"])
    expect(issues({ home: [rail({ tabs: false })] })).toEqual(["storefront_layout.section_invalid"])
  })

  it("prints the setting to the store only when set apart", () => {
    expect(hydrateShelf(products.parse(rail()), undefined, null)).not.toHaveProperty("tabs")
    expect(hydrateShelf(products.parse(rail({ tabs: "off" })), undefined, null)).toMatchObject({
      tabs: "off",
    })
  })

  it("mirrors the contract's list: a step goes there first", () => {
    const shelf = jest.requireActual<Record<string, unknown>>(`${CONTRACT}/section-shelf.ts`)
    expect(SHELF_TABS).toEqual(shelf["SHELF_TABS"])
    expect(SHELF_TABS_DEFAULT).toEqual(shelf["SHELF_TABS_DEFAULT"])
  })
})
