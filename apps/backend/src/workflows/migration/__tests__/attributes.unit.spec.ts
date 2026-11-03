import { SHEET_COLUMNS } from "../../../lib/catalog-sheet"
import { wordpressRecords } from "../../../lib/migration/sources/wordpress"
import { wxrFixture } from "../../../lib/migration/sources/wordpress/__tests__/wxr"
import { attributeOutcome, valueList } from "../attribute-report"
import {
  attributeColumns,
  attributeHeaders,
  planAttributes,
  withAttributeCells,
} from "../attributes"
import type { AttributedProduct, SourceAttribute, TemplateFields } from "../attributes"

const choice = (value: string, label: string) => ({ value, label })

// A shop's templates, neutral: one for home goods, one with a required field
const HOME: TemplateFields = {
  handle: "ev",
  fields: [
    {
      key: "malzeme",
      label: "Malzeme",
      type: "multi_select",
      scope: "product",
      is_required: false,
      options: [choice("kayin", "Kayın"), choice("ceviz", "Ceviz")],
    },
    {
      key: "renk_tonu",
      label: "Renk",
      type: "select",
      scope: "product",
      is_required: false,
      options: [choice("acik", "Açık"), choice("koyu", "Koyu")],
    },
    {
      key: "notlar",
      label: "Notlar",
      type: "text",
      scope: "product",
      is_required: false,
      options: null,
    },
    {
      key: "agirlik",
      label: "Ağırlık",
      type: "number",
      scope: "product",
      is_required: false,
      options: null,
    },
  ],
}
const STRICT: TemplateFields = {
  handle: "zorunlu",
  fields: [
    {
      key: "desen",
      label: "Desen",
      type: "text",
      scope: "product",
      is_required: false,
      options: null,
    },
    {
      key: "beden",
      label: "Beden",
      type: "text",
      scope: "product",
      is_required: true,
      options: null,
    },
  ],
}

const attribute = (key: string, slug: string, values: string[]): SourceAttribute => ({
  key,
  slug,
  name: slug,
  values,
})

describe("descriptive attributes to the shop's template (adr/0042 Ek 2026-11-03)", () => {
  it("matches a field by its key, or its label as a slug, and writes values it takes", () => {
    const plan = planAttributes(
      [
        attribute("pa_malzeme", "malzeme", ["Kayın", "Ceviz"]),
        // Matched by the field's label: "Renk" → renk
        attribute("pa_renk", "renk", ["Koyu"]),
        attribute("notlar", "notlar", ["Elde yıkayın", "Kurulayın"]),
        attribute("pa_agirlik", "agirlik", ["1,5"]),
      ],
      [HOME, STRICT]
    )
    expect(plan).toEqual({
      template: "ev",
      cells: {
        malzeme: "Kayın|Ceviz",
        renk_tonu: "Koyu",
        notlar: "Elde yıkayın, Kurulayın",
        agirlik: "1,5",
      },
      written: ["pa_malzeme", "pa_renk", "notlar", "pa_agirlik"],
      unmatched: [],
      unfit: [],
      elsewhere: [],
      requiredMissing: false,
    })
  })

  it("never makes a choice the field does not have, and names what it left", () => {
    const plan = planAttributes(
      [
        attribute("pa_malzeme", "malzeme", ["Kayın", "Meşe"]),
        // One choice only
        attribute("pa_renk", "renk", ["Açık", "Koyu"]),
        attribute("pa_agirlik", "agirlik", ["hafif"]),
        attribute("notlar", "notlar", ["Tek parça"]),
        attribute("pa_desen", "desen", ["Çizgili"]),
        attribute("pa_mensei", "mensei", ["Yerli"]),
      ],
      [HOME, STRICT]
    )
    expect(plan).toMatchObject({
      template: "ev",
      cells: { notlar: "Tek parça" },
      written: ["notlar"],
      unfit: ["pa_malzeme", "pa_renk", "pa_agirlik"],
      // Only the other template has it: a product takes one
      elsewhere: ["pa_desen"],
      unmatched: ["pa_mensei"],
      requiredMissing: false,
    })
  })

  it("gives one field the values of two attributes it matches, when it takes them together", () => {
    const plan = planAttributes(
      [
        attribute("pa_malzeme", "malzeme", ["Kayın"]),
        attribute("malzeme", "malzeme", ["Kayın", "Ceviz"]),
        // A single choice cannot take two
        attribute("pa_renk", "renk", ["Koyu"]),
        attribute("renk", "renk", ["Açık"]),
      ],
      [HOME]
    )
    expect(plan).toMatchObject({
      cells: { malzeme: "Kayın|Ceviz" },
      written: ["pa_malzeme", "malzeme"],
      unfit: ["pa_renk", "renk"],
    })
  })

  it("gives no template whose required field stays empty", () => {
    const plan = planAttributes([attribute("pa_desen", "desen", ["Çizgili"])], [HOME, STRICT])
    expect(plan).toMatchObject({ template: null, cells: {}, written: [], requiredMissing: true })
    expect(planAttributes([attribute("pa_desen", "desen", ["Çizgili"])], [])).toMatchObject({
      template: null,
      unmatched: ["pa_desen"],
      requiredMissing: false,
    })
  })

  it("puts the template and values on a product's first row, as the import reads its own cells", () => {
    const plan = planAttributes([attribute("notlar", "notlar", ["Not"])], [HOME])
    const columns = attributeColumns([plan, undefined])
    expect(attributeHeaders(columns)).toEqual(["Özellik: notlar"])
    const width = SHEET_COLUMNS.length
    const rows = withAttributeCells(
      [Array<null>(width).fill(null), Array<null>(width).fill(null)],
      plan,
      columns
    )
    const template = SHEET_COLUMNS.findIndex((column) => column.key === "template")
    expect(rows[0]?.[template]).toBe("ev")
    expect(rows[0]?.slice(width)).toEqual(["Not"])
    expect(rows[1]?.[template]).toBeNull()
    expect(rows[1]?.slice(width)).toEqual([null])
    // A product without a template: empty cells under every column
    expect(withAttributeCells([Array<null>(width).fill(null)], undefined, columns)[0]).toHaveLength(
      width + 1
    )
  })

  it("reads a WordPress export's attributes as the run takes them", () => {
    const products: readonly AttributedProduct[] = wordpressRecords(wxrFixture()).products
    const plans = new Map(
      products.map((product) => [
        product.source_key,
        planAttributes(product.attributes ?? [], [HOME]),
      ])
    )
    expect(plans.get("product:20")).toMatchObject({
      template: "ev",
      cells: { malzeme: "Kayın|Ceviz" },
    })
    expect(plans.get("product:10")).toMatchObject({
      template: null,
      unmatched: ["pa_desen"],
      unfit: ["pa_malzeme"],
    })
  })
})

describe("the attributes in the report", () => {
  it("lists at most fifty values, the commonest first, with their products", () => {
    expect(
      valueList(
        new Map([
          ["B", 1],
          ["A", 1],
          ["C", 3],
        ])
      )
    ).toBe("C (3); A (1); B (1)")
    const many = new Map(
      Array.from({ length: 53 }, (_, i) => [`d${String(i).padStart(2, "0")}`, 1])
    )
    const text = valueList(many)
    expect(text.split("; ")).toHaveLength(51)
    expect(text.endsWith("… +3 değer")).toBe(true)
  })

  it("counts each product's attribute once and names what stayed, by attribute", () => {
    const product = (key: string, attributes: SourceAttribute[]): AttributedProduct => ({
      source_key: key,
      handle: key,
      title: key,
      description: null,
      status: "draft",
      categories: [],
      brand: null,
      seo_title: null,
      seo_description: null,
      images: [],
      options: [],
      variants: [],
      dimensions: null,
      old_url: null,
      attributes,
    })
    const products = [
      product("p1", [
        attribute("pa_malzeme", "malzeme", ["Kayın"]),
        attribute("pa_mensei", "mensei", ["Yerli"]),
      ]),
      product("p2", [
        attribute("pa_malzeme", "malzeme", ["Meşe"]),
        attribute("pa_mensei", "mensei", ["Yerli", "İthal"]),
      ]),
      product("p3", [attribute("pa_desen", "desen", ["Düz"])]),
      // Moved by a run before: left as the shop keeps it
      product("p4", [attribute("pa_mensei", "mensei", ["İthal"])]),
      product("p5", []),
    ]
    const plans = new Map(
      products.map((each) => [
        each.source_key,
        planAttributes(each.attributes ?? [], [HOME, STRICT]),
      ])
    )
    const { counts, problems } = attributeOutcome(
      products,
      plans,
      new Set(["p1", "p2", "p3"]),
      new Set(["p4"])
    )
    expect(counts).toEqual({ read: 6, created: 1, found: 1, skipped: 4 })
    expect(problems).toEqual([
      {
        kind: "product",
        source_key: 'pa_mensei "mensei": 3 ürün, 2 değer: İthal (2); Yerli (2)',
        key: "migration.wordpress_attribute_not_moved",
      },
      {
        kind: "product",
        source_key: 'pa_malzeme "malzeme": 1 ürün, 1 değer: Meşe (1)',
        key: "catalog_import.attribute_invalid",
      },
      { kind: "product", source_key: "p3", key: "catalog_import.attribute_required" },
    ])
  })
})
