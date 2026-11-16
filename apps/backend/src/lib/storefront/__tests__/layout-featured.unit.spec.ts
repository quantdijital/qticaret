import path from "node:path"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument } from "../layout"
import {
  FEATURED_PRODUCT_DEFAULTS,
  FEATURED_PRODUCT_SETTINGS,
  FEATURED_STRIPS_SETTINGS,
  featuredProduct,
} from "../sections/featured-product"

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
    expect(FEATURED_PRODUCT_DEFAULTS.gallery).toBe("collage")
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
    expect(FEATURED_STRIPS_SETTINGS).toEqual(contract["FEATURED_STRIPS_SETTINGS"])
  })
})

describe("the strips' look (adr/0049 Ek 2026-11-16)", () => {
  it("fills the bolder defaults where a section saved before them has none", () => {
    const doc = layoutDocument.parse({ home: [featured({ gallery: "strips" })] })

    expect(doc.home[0]).toMatchObject({
      strips_layout: "side",
      strips_slant: "medium",
      strips_line: "thin",
      strips_overlap: "off",
      strips_dim: "on",
    })
  })

  it("keeps every step as saved and refuses one off its list", () => {
    const look = {
      strips_layout: "wide",
      strips_slant: "steep",
      strips_line: "none",
      strips_overlap: "on",
      strips_dim: "off",
    }
    expect(layoutDocument.parse({ home: [featured(look)] }).home[0]).toMatchObject(look)
    expect(issues({ home: [featured({ strips_slant: "vertical" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [featured({ strips_overlap: true })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  const at = { values: {} } as unknown as HydrateContext
  const base = { id: "yakin001", type: "featured_product", title: null, text: null }

  it("prints the collage as before: no setting at all, the strips' look left out", async () => {
    const section = featuredProduct.parse(featured({ strips_slant: "steep" }))

    expect(await hydrateSection(section, at)).toEqual({ ...base, product_id: "prod_1" })
  })

  it("prints the strips with every step of their look", async () => {
    const section = featuredProduct.parse(featured({ gallery: "strips", strips_overlap: "on" }))

    expect(await hydrateSection(section, at)).toEqual({
      ...base,
      product_id: "prod_1",
      gallery: "strips",
      strips_layout: "side",
      strips_slant: "medium",
      strips_line: "thin",
      strips_overlap: "on",
      strips_dim: "on",
    })
  })
})
