import { hydratePriceBands } from "../../../workflows/storefront/layout-hydrate-catalog"
import { layoutDocument } from "../layout"

// A price band's own category (adr/0049, dated line 2026-11-15 on the note "Katalog ana sayfası")
const bands = (list: unknown[]) => ({ id: "fiyatbant1", type: "price_bands", bands: list })
const band = (label: string, max: number | null) => ({ label, max })
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("a price band's category", () => {
  it("reads a strip saved before band categories as it was: every band a price band", () => {
    const [section] = layoutDocument.parse({
      home: [bands([band("₺500 altı", 500), band("Üstü", null)])],
    }).home
    if (section?.type !== "price_bands") {
      throw new Error("no bands")
    }

    expect(section.bands.map((each) => each.category_id)).toEqual([null, null])
    expect(hydratePriceBands(section, undefined, (text) => text).bands).toEqual([
      { label: "₺500 altı", text: null, min: null, max: 500, product_ids: [] },
      { label: "Üstü", text: null, min: 501, max: null, product_ids: [] },
    ])
  })

  it("takes a band with a category, its bound free of the price bands' order", () => {
    const own = (label: string, max: number | null, category_id: string) => ({
      label,
      max,
      category_id,
    })

    // A category band without a price, anywhere; its bound below the price band before's
    expect(
      issues({
        home: [
          bands([
            own("Koleksiyon", null, "pcat_koleksiyon"),
            band("₺500 altı", 500),
            own("Kamp, ₺300'e kadar", 300, "pcat_kamp"),
            band("Üstü", null),
          ]),
        ],
      })
    ).toEqual([])
    // An open price band is still the last price band, a category band after it aside
    expect(
      issues({
        home: [bands([band("₺500 altı", 500), band("Üstü", null), own("Kamp", null, "pcat_kamp")])],
      })
    ).toEqual([])
    expect(
      issues({
        home: [bands([band("Açık", null), own("Kamp", null, "pcat_kamp"), band("Ucuz", 500)])],
      })
    ).toEqual(["storefront_layout.price_bands_order"])
    // A record id, nothing else
    expect(issues({ home: [bands([own("Kamp", null, "kamp"), band("Ucuz", 500)])] })).toHaveLength(
      1
    )
  })

  it("prints a category band's category and range: its own bound, the price bands' chain apart", () => {
    const [section] = layoutDocument.parse({
      home: [
        bands([
          band("₺500 altı", 500),
          { label: "Kamp", max: 1000, category_id: "pcat_kamp" },
          band("₺2.500 altı", 2500),
          { label: "Koleksiyonluk", max: null, category_id: "pcat_koleksiyon" },
        ]),
      ],
    }).home
    if (section?.type !== "price_bands") {
      throw new Error("no bands")
    }

    expect(hydratePriceBands(section, [[], ["prod_k"], [], []], (text) => text).bands).toEqual([
      { label: "₺500 altı", text: null, min: null, max: 500, product_ids: [] },
      {
        label: "Kamp",
        text: null,
        category_id: "pcat_kamp",
        min: null,
        max: 1000,
        product_ids: ["prod_k"],
      },
      { label: "₺2.500 altı", text: null, min: 501, max: 2500, product_ids: [] },
      {
        label: "Koleksiyonluk",
        text: null,
        category_id: "pcat_koleksiyon",
        min: null,
        max: null,
        product_ids: [],
      },
    ])
  })
})
