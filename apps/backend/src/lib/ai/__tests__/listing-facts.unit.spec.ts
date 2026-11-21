import { Modules } from "@medusajs/framework/utils"
import { AI_ENTITY_ID_PREFIX, entityFacts } from "../facts"
import {
  BRAND_FACT_FIELDS,
  COLLECTION_FACT_FIELDS,
  brandFacts,
  collectionFacts,
} from "../facts/listing"
import {
  LISTING_BRAND_FIELDS,
  LISTING_CATEGORY_FIELDS,
  LISTING_CHANNEL_FIELD,
  LISTING_PRODUCT_FIELDS,
} from "../facts/listing-products"
import type { FactsContainer } from "../facts/types"

/**
 * A collection's and a brand's facts (adr/0074 §5 madde 1, adr/0071 §10):
 * name, plain text description, search fields and what the page lists,
 * read like a category's; never a price, stock, customer or staff field,
 * never a product outside the storefront's channels, a closed brand or an
 * internal or closed category.
 */

const FORBIDDEN = /price|stock|inventory|order|customer|cart|cost|variant|metadata|user|staff/i

interface Asked {
  entity: string
  fields: string[]
  filters: Record<string, unknown>
}

const STOREFRONT_KEYS = [{ id: "apk_1", revoked_at: null, sales_channels: [{ id: "sc_1" }] }]

function containerWith(
  graphs: unknown[][],
  listing: { rows: { id: string; title: string }[]; count: number } = { rows: [], count: 0 },
  keys: unknown[] = STOREFRONT_KEYS
) {
  const asked: Asked[] = []
  const listed: Record<string, unknown>[] = []
  const query = {
    graph: (request: Asked) => {
      if (request.entity === "api_key") {
        return Promise.resolve({ data: keys })
      }
      asked.push(request)
      return Promise.resolve({ data: graphs[asked.length - 1] ?? [] })
    },
  }
  const products = {
    listAndCountProducts: (filters: Record<string, unknown>) => {
      listed.push(filters)
      return Promise.resolve([listing.rows, listing.count])
    },
  }
  const container: FactsContainer = {
    resolve: (key: string) => (key === Modules.PRODUCT ? products : query),
  }
  return { container, asked, listed }
}

const rows = Array.from({ length: 6 }, (_, index) => ({
  id: `prod_${String(index)}`,
  title: `Termos ${String(index)}`,
}))

const SEO = { focus_keyword: "piknik termos", seo_title: "Piknik | Demo", seo_description: null }

describe("a collection's facts", () => {
  const COLLECTION = {
    title: "Piknik",
    collection_extension: { description: "<p>Açık hava için seçki.</p>" },
    seo_meta: SEO,
  }
  const linked = rows.map((row, index) => ({
    id: row.id,
    sales_channels: index === 0 ? [{ id: "sc_other" }] : [{ id: "sc_1" }],
    brand:
      index < 3
        ? { name: "Alfa", is_active: true }
        : index < 5
          ? { name: "Kapalı", is_active: false }
          : null,
  }))

  it("names its products in the storefront's channels and their shown brands, nothing priced", async () => {
    const { container, asked, listed } = containerWith([[COLLECTION], linked], { rows, count: 6 })
    const facts = await collectionFacts(container, "pcol_1")

    expect(listed[0]).toEqual({ collection_id: "pcol_1", status: "published" })
    expect(facts).toEqual({
      name: "Piknik",
      focus_keyword: "piknik termos",
      current_seo_title: "Piknik | Demo",
      current_seo_description: null,
      products: "Termos 1, Termos 2, Termos 3, Termos 4, Termos 5",
      brands: "Alfa",
      product_count: "5 ürün",
      description: "Açık hava için seçki.",
    })
    expect(asked[0]).toMatchObject({ entity: "product_collection", filters: { id: "pcol_1" } })
    expect(asked[1]?.fields).toEqual([...LISTING_BRAND_FIELDS, LISTING_CHANNEL_FIELD])
    for (const field of [
      ...COLLECTION_FACT_FIELDS,
      ...LISTING_PRODUCT_FIELDS,
      ...LISTING_BRAND_FIELDS,
    ]) {
      expect(field).not.toMatch(FORBIDDEN)
    }
  })

  it("names no product when the storefront has no channel", async () => {
    const { container, asked } = containerWith([[COLLECTION], linked], { rows, count: 6 }, [])
    expect(await collectionFacts(container, "pcol_1")).toMatchObject({
      products: null,
      brands: null,
      product_count: null,
    })
    expect(asked).toHaveLength(1)
  })

  it("answers a missing collection as unknown", async () => {
    const { container } = containerWith([[]])
    await expect(collectionFacts(container, "pcol_x")).rejects.toThrow("ai.unknown_entity")
  })
})

describe("a brand's facts", () => {
  const BRAND = {
    name: "Örnekmarka",
    description: "Günlük kullanım için kaplar.",
    products: rows.map((row) => ({ id: row.id })),
    seo_meta: SEO,
  }
  const linked = rows.map((row, index) => ({
    id: row.id,
    sales_channels: [{ id: "sc_1" }],
    categories: [
      { name: "Termoslar", is_active: true, is_internal: false },
      index < 2 ? { name: "Toptan Gizli", is_active: true, is_internal: true } : null,
      index < 4 ? { name: "Kapalı Raf", is_active: false, is_internal: false } : null,
      index > 3 ? { name: "Mataralar", is_active: true, is_internal: false } : null,
    ],
  }))

  it("names its products and their most frequent shown categories, never internal or closed", async () => {
    const { container, asked, listed } = containerWith([[BRAND], linked], { rows, count: 6 })
    const facts = await brandFacts(container, "brand_1")

    expect(listed[0]).toEqual({ id: rows.map((row) => row.id), status: "published" })
    expect(facts).toMatchObject({
      name: "Örnekmarka",
      categories: "Termoslar, Mataralar",
      product_count: "6 ürün",
      description: "Günlük kullanım için kaplar.",
      focus_keyword: "piknik termos",
    })
    expect(facts).not.toHaveProperty("brands")
    expect(JSON.stringify(facts)).not.toMatch(/Toptan Gizli|Kapalı Raf/)
    expect(asked[0]).toMatchObject({ entity: "brand", fields: [...BRAND_FACT_FIELDS] })
    expect(asked[1]?.fields).toEqual([...LISTING_CATEGORY_FIELDS, LISTING_CHANNEL_FIELD])
    for (const field of [...BRAND_FACT_FIELDS, ...LISTING_CATEGORY_FIELDS]) {
      expect(field).not.toMatch(FORBIDDEN)
    }
  })

  it("reads no product for a brand with none", async () => {
    const { container, listed } = containerWith([[{ ...BRAND, products: [] }]])
    expect(await brandFacts(container, "brand_1")).toMatchObject({
      products: null,
      categories: null,
      product_count: null,
    })
    expect(listed).toEqual([])
  })

  it("answers a missing brand as unknown", async () => {
    const { container } = containerWith([[]])
    await expect(brandFacts(container, "brand_x")).rejects.toThrow("ai.unknown_entity")
  })
})

describe("the doors for the new kinds", () => {
  it("takes a collection and a brand by their own id prefixes only", async () => {
    expect(AI_ENTITY_ID_PREFIX).toMatchObject({ collection: "pcol", brand: "brand" })
    const { container, asked } = containerWith([])
    await expect(entityFacts(container, "collection", "brand_1")).rejects.toThrow(
      "ai.unknown_entity"
    )
    await expect(entityFacts(container, "brand", "pcol_1")).rejects.toThrow("ai.unknown_entity")
    expect(asked).toEqual([])
  })
})
