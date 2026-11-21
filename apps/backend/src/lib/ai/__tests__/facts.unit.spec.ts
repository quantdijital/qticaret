import { entityFacts } from "../facts"
import { CATEGORY_FACT_FIELDS, categoryFacts } from "../facts/category"
import { PAGE_FACT_FIELDS, pageFacts } from "../facts/page"
import { PRODUCT_FACT_FIELDS, productFacts } from "../facts/product"
import type { FactsContainer } from "../facts/types"
import { buildPrompt } from "../prompt"

/**
 * adr/0071 §10, adr/0005 (PR 1-1): what leaves the shop of a product, a
 * category and a content page. Read by id on the server, public fields
 * only, and every value through the personal data filter on its way out.
 */

const PERSONAL =
  "Bilgi için ayse.yilmaz@example.com ya da 0532 123 45 67; TC 12345678901, IBAN TR33 0006 1005 1978 6457 8413 26."

interface Asked {
  entity: string
  fields: string[]
  filters: Record<string, unknown>
}

// A product's categories and their ancestors, as the tree check reads them (facts/category-tree.ts)
const TREE = [
  { id: "pcat_hidden", is_internal: true, is_active: true, parent_category_id: null },
  { id: "pcat_closed", is_internal: false, is_active: false, parent_category_id: null },
  { id: "pcat_shirts", is_internal: false, is_active: true, parent_category_id: null },
  { id: "pcat_sub", is_internal: false, is_active: true, parent_category_id: "pcat_hidden" },
]

function containerWith(rows: unknown[]): { container: FactsContainer; asked: Asked[] } {
  const asked: Asked[] = []
  const query = {
    graph: (request: Asked) => {
      asked.push(request)
      if (request.fields.includes("parent_category_id")) {
        return Promise.resolve({ data: TREE })
      }
      return Promise.resolve({ data: rows })
    },
    // A category's listing (facts/category-products.ts): none here
    listAndCountProducts: () => Promise.resolve([[], 0]),
  }
  return { container: { resolve: () => query }, asked }
}

// No reader may even ask for these (adr/0071 §10)
const FORBIDDEN = /price|stock|inventory|order|customer|cart|cost|author|created_by|metadata/i

const dataOf = (fields: Record<string, unknown>) =>
  JSON.parse(buildPrompt({ instruction: "x", fields: fields as never }).data) as {
    data: Record<string, unknown>
  }

describe("AI record facts (adr/0071 §10)", () => {
  it("asks only for named public fields of each record", () => {
    for (const fields of [PRODUCT_FACT_FIELDS, CATEGORY_FACT_FIELDS, PAGE_FACT_FIELDS]) {
      for (const field of fields) {
        expect(field).not.toMatch(FORBIDDEN)
      }
    }
  })
  it("names no category under an internal parent nor a hidden collection (#250 D1, B1)", async () => {
    const product = (collection: unknown) => ({
      title: "Keten Gömlek",
      categories: [
        { id: "pcat_sub", mpath: "pcat_hidden.pcat_sub", name: "Gizli Alt", is_internal: false },
        { id: "pcat_shirts", mpath: "pcat_shirts", name: "Gömlekler", is_internal: false },
      ],
      collection,
    })
    const hidden = containerWith([
      product({ title: "Kapalı Seçki", collection_extension: { is_active: false } }),
    ])
    const facts = await productFacts(hidden.container, "prod_1")
    expect(facts).toMatchObject({ category: "Gömlekler", collection: null })
    expect(JSON.stringify(facts)).not.toMatch(/Gizli Alt|Kapalı Seçki/)
    expect(hidden.asked[1]).toMatchObject({ entity: "product_category" })
    expect(PRODUCT_FACT_FIELDS).toContain("collection.collection_extension.is_active")

    const shown = containerWith([product({ title: "Yaz Seçkisi", collection_extension: null })])
    expect((await productFacts(shown.container, "prod_1"))["collection"]).toBe("Yaz Seçkisi")
  })

  it("sends a product's public attributes only, and no internal category", async () => {
    const { container, asked } = containerWith([
      {
        title: "Keten Gömlek",
        subtitle: null,
        description: `<p>Yazlık gömlek.</p> ${PERSONAL}`,
        brand: { name: "Marka" },
        categories: [
          { id: "pcat_hidden", name: "Gizli Toptan", is_internal: true },
          { id: "pcat_closed", name: "Kapalı Sezon", is_internal: false, is_active: false },
          { id: "pcat_shirts", mpath: "pcat_shirts", name: "Gömlekler", is_internal: false },
        ],
        attribute_values: [
          { value_text: "Keten", definition: { label: "Malzeme", type: "text", is_public: true } },
          {
            value_text: "Tedarikçi X",
            definition: { label: "Tedarikçi", type: "text", is_public: false },
          },
        ],
      },
    ])

    const facts = await productFacts(container, "prod_1")
    const sent = JSON.stringify(dataOf(facts))

    expect(asked[0]).toMatchObject({ entity: "product", filters: { id: "prod_1" } })
    expect(facts).toMatchObject({
      name: "Keten Gömlek",
      category: "Gömlekler",
      attributes: [{ label: "Malzeme", value: "Keten" }],
    })
    expect(sent).not.toContain("Tedarikçi")
    expect(sent).not.toContain("Gizli Toptan")
    expect(sent).not.toContain("Kapalı Sezon")
    expect(sent).not.toContain("<p>")
    for (const leak of ["ayse.yilmaz", "123 45 67", "12345678901", "1978 6457"]) {
      expect(sent).not.toContain(leak)
    }
  })

  it("sends a category's name, description and shown relatives only", async () => {
    const { container, asked } = containerWith([
      {
        name: "Gömlekler",
        description: `Yazlık ve kışlık gömlekler. ${PERSONAL}`,
        is_internal: false,
        parent_category: { name: "Giyim", is_internal: false },
        category_children: [
          { name: "Keten", is_internal: false },
          { name: "Stok Fazlası", is_internal: true },
          { name: "Hazırlanan Seri", is_internal: false, is_active: false },
          null,
        ],
      },
    ])

    const facts = await categoryFacts(container, "pcat_1")
    const sent = JSON.stringify(dataOf(facts))

    expect(asked[0]).toMatchObject({ entity: "product_category", filters: { id: "pcat_1" } })
    expect(facts).toMatchObject({ name: "Gömlekler", parent: "Giyim", subcategories: "Keten" })
    expect(sent).not.toContain("Stok Fazlası")
    expect(sent).not.toContain("Hazırlanan Seri")
    for (const leak of ["ayse.yilmaz", "123 45 67", "12345678901"]) {
      expect(sent).not.toContain(leak)
    }
  })

  it("readies a closed category, naming no closed parent", async () => {
    const { container } = containerWith([
      {
        name: "Yeni Sezon",
        is_internal: false,
        is_active: false,
        parent_category: { name: "Gizli Kampanya", is_internal: false, is_active: false },
        category_children: [],
      },
    ])

    const facts = await categoryFacts(container, "pcat_1")

    expect(facts).toMatchObject({ name: "Yeni Sezon", parent: null, subcategories: null })
    expect(CATEGORY_FACT_FIELDS).toEqual(
      expect.arrayContaining(["parent_category.is_active", "category_children.is_active"])
    )
    expect(PRODUCT_FACT_FIELDS).toContain("categories.is_active")
  })

  it("answers an internal category or a missing record as unknown", async () => {
    await expect(
      categoryFacts(containerWith([{ name: "Gizli", is_internal: true }]).container, "pcat_1")
    ).rejects.toThrow("ai.unknown_entity")
    await expect(productFacts(containerWith([]).container, "prod_1")).rejects.toThrow(
      "ai.unknown_entity"
    )
    await expect(pageFacts(containerWith([]).container, "cnt_1")).rejects.toThrow(
      "ai.unknown_entity"
    )
  })

  it("sends a page's title and summaries, read as a page and never as a post", async () => {
    const { container, asked } = containerWith([
      {
        title: "Hakkımızda",
        excerpt: "Atölyemizin hikâyesi.",
        body_summary: `Yirmi yıldır üretiyoruz. ${PERSONAL}`,
        author_name: "Ayşe Yılmaz",
      },
    ])

    const facts = await pageFacts(container, "cnt_1")
    const sent = JSON.stringify(dataOf(facts))

    expect(asked[0]).toMatchObject({
      entity: "content_entry",
      filters: { id: "cnt_1", kind: "page" },
    })
    expect(Object.keys(facts)).toEqual(["name", "summary", "body"])
    expect(sent).not.toContain("Ayşe Yılmaz")
    for (const leak of ["ayse.yilmaz", "123 45 67", "12345678901"]) {
      expect(sent).not.toContain(leak)
    }
  })

  it("turns away an id of another kind before reading anything", async () => {
    const { container, asked } = containerWith([{ title: "x" }])

    await expect(entityFacts(container, "category", "prod_1")).rejects.toThrow("ai.unknown_entity")
    await expect(entityFacts(container, "page", "pcat_1")).rejects.toThrow("ai.unknown_entity")
    await expect(entityFacts(container, "order" as never, "order_1")).rejects.toThrow(
      "ai.unknown_entity"
    )
    expect(asked).toEqual([])
  })
})
