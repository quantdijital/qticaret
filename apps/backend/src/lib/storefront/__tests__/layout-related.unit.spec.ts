import { layoutDocument, readStoredLayout } from "../layout"
import { SCROLLER_DEFAULTS } from "../sections/scroller"

const related = (more: Record<string, unknown> = {}) => ({
  id: "benzer0001",
  type: "related_products",
  title: null,
  source: { kind: "same_category" },
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the related products' variant and card (bilesen-denetimi (b) 7)", () => {
  it("reads a rail saved before them as today's grid with the theme's card", () => {
    const doc = layoutDocument.parse({ product: [related({ columns: 4 })] })

    expect(doc.product[0]).toMatchObject({
      variant: "grid",
      columns: 4,
      columns_mobile: 2,
      card_variant: null,
      limit: 8,
    })
  })

  it("keeps a carousel's scroller, filled with the defaults, and the rail's own card", () => {
    const doc = layoutDocument.parse({
      product: [
        related({ variant: "carousel", scroller: { arrows: "hover" }, card_variant: "framed" }),
      ],
    })

    expect(doc.product[0]).toMatchObject({
      variant: "carousel",
      scroller: { ...SCROLLER_DEFAULTS, arrows: "hover" },
      card_variant: "framed",
    })
    expect(doc.product[0]).not.toHaveProperty("columns")
  })

  it("refuses a variant or a card off its list, and the other variant's field", () => {
    for (const bad of [related({ variant: "featured" }), related({ card_variant: "tall" })]) {
      expect(issues({ product: [bad] })).toEqual(["storefront_layout.section_invalid"])
    }
    for (const bad of [
      related({ variant: "carousel", columns: 4 }),
      related({ variant: "grid", scroller: SCROLLER_DEFAULTS }),
    ]) {
      expect(issues({ product: [bad] })).toHaveLength(1)
    }
  })

  it("reads a stored variant or card off today's list as the grid and the theme's card", () => {
    const stored = readStoredLayout({
      product: [related({ variant: "mosaic", card_variant: "tall", columns: 5 })],
    })

    expect(stored.product[0]).toMatchObject({ variant: "grid", card_variant: null, columns: 5 })
  })
})
