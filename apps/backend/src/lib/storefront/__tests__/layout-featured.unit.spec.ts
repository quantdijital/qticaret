import path from "node:path"
import { layoutDocument } from "../layout"
import { FEATURED_PRODUCT_DEFAULTS, FEATURED_PRODUCT_SETTINGS } from "../sections/featured-product"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-featured.ts"
)

const featured = (more: Record<string, unknown> = {}) => ({
  id: "yakin001",
  type: "featured_product",
  product_id: "prod_1",
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the featured product's photographs layout (adr/0049 Ek 2026-11-15)", () => {
  it("reads a section saved before it as it was drawn: the collage", () => {
    const doc = layoutDocument.parse({ home: [featured()] })

    expect(doc.home[0]).toMatchObject({ gallery: "collage" })
    expect(FEATURED_PRODUCT_DEFAULTS).toEqual({ gallery: "collage" })
  })

  it("keeps the shop's strips as saved", () => {
    const doc = layoutDocument.parse({ home: [featured({ gallery: "strips" })] })

    expect(doc.home[0]).toMatchObject({ gallery: "strips" })
  })

  it("refuses a step off its list with the section's error key", () => {
    expect(issues({ home: [featured({ gallery: "mosaic" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [featured({ gallery: true })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("mirrors the contract's lists: a step goes there first", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(FEATURED_PRODUCT_SETTINGS).toEqual(contract["FEATURED_PRODUCT_SETTINGS"])
    expect(FEATURED_PRODUCT_DEFAULTS).toEqual(contract["FEATURED_PRODUCT_DEFAULTS"])
  })
})
