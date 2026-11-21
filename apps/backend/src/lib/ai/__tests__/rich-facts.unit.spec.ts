import { Modules } from "@medusajs/framework/utils"
import { categoryFacts } from "../facts/category"
import {
  CATEGORY_BRAND_FIELDS,
  CATEGORY_CHANNEL_FIELD,
  CATEGORY_PRODUCT_EXAMPLES,
  CATEGORY_PRODUCT_FIELDS,
  productCountLabel,
} from "../facts/category-products"
import { PRODUCT_FACT_FIELDS, productFacts, readProductFacts } from "../facts/product"
import { SEO_FACT_FIELDS } from "../facts/seo"
import { STOREFRONT_KEY_FIELDS, storefrontChannelIds } from "../facts/storefront-channels"
import type { FactsContainer } from "../facts/types"

/**
 * adr/0074 §4 within adr/0071 §10: a product's options, collection, tags
 * and search fields, and what a category lists (published products'
 * names, frequent brands, a count range). Names only; no price, stock,
 * variant, order or customer field is asked for.
 */

const FORBIDDEN = /price|stock|inventory|order|customer|cart|cost|variant|sales|metadata/i

interface Asked {
  entity: string
  fields: string[]
  filters: Record<string, unknown>
}

interface Listed {
  filters: Record<string, unknown>
  config: { select: string[]; take: number }
}

// The storefront's publishable key and its channel (#247 D2): read apart from the record's graphs
const STOREFRONT_KEYS = [{ id: "apk_1", revoked_at: null, sales_channels: [{ id: "sc_1" }] }]

function containerWith(
  graphs: unknown[][],
  listing: { rows: { id: string; title: string }[]; count: number } = { rows: [], count: 0 },
  keys: unknown[] = STOREFRONT_KEYS
) {
  const asked: Asked[] = []
  const listed: Listed[] = []
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
    listAndCountProducts: (filters: Record<string, unknown>, config: Listed["config"]) => {
      listed.push({ filters, config })
      return Promise.resolve([listing.rows, listing.count])
    },
  }
  const container: FactsContainer = {
    resolve: (key: string) => (key === Modules.PRODUCT ? products : query),
  }
  return { container, asked, listed }
}

const PRODUCT = {
  title: "Keten Gömlek",
  description: "<p>Yazlık gömlek.</p>",
  options: [
    { title: "Renk", values: [{ value: "Bej" }, { value: "Lacivert" }, null] },
    { title: "Default option", values: [{ value: "Default option value" }] },
    { title: "Beden", values: [] },
  ],
  collection: { title: "Yaz Koleksiyonu" },
  tags: [{ value: "keten" }, { value: "yazlık" }, { value: "" }],
  seo_meta: {
    focus_keyword: "keten gömlek",
    seo_title: "Keten Gömlek | Demo",
    seo_description: null,
  },
}

describe("a product's richer facts", () => {
  it("names its options, collection, tags and search fields, and asks for nothing priced", async () => {
    const { container, asked } = containerWith([[PRODUCT]])
    const facts = await productFacts(container, "prod_1")

    expect(facts).toMatchObject({
      options: [{ label: "Renk", value: "Bej, Lacivert" }],
      collection: "Yaz Koleksiyonu",
      tags: "keten, yazlık",
      focus_keyword: "keten gömlek",
      current_seo_title: "Keten Gömlek | Demo",
      current_seo_description: null,
    })
    expect(asked[0]?.fields).toEqual(expect.arrayContaining([...SEO_FACT_FIELDS]))
    for (const field of [...PRODUCT_FACT_FIELDS, ...SEO_FACT_FIELDS]) {
      expect(field).not.toMatch(FORBIDDEN)
    }
  })

  it("names no brand the shop closed (B4)", async () => {
    const { container, asked } = containerWith([
      [{ ...PRODUCT, brand: { name: "Kapalı Marka", is_active: false } }],
      [{ ...PRODUCT, brand: { name: "Açık Marka", is_active: true } }],
    ])
    expect((await productFacts(container, "prod_1"))["brand"]).toBeNull()
    expect(asked[0]?.fields).toContain("brand.is_active")
    expect((await productFacts(container, "prod_1"))["brand"]).toBe("Açık Marka")
  })

  it("leaves the search fields out where another task reads the product (a review, an image)", async () => {
    const { container, asked } = containerWith([[PRODUCT]])
    const facts = await readProductFacts(container, "prod_1")
    expect(facts).not.toHaveProperty("focus_keyword")
    expect(asked[0]?.fields).not.toEqual(expect.arrayContaining(["seo_meta.focus_keyword"]))
  })
})

describe("what a category lists", () => {
  const CATEGORY = {
    name: "Gömlekler",
    is_internal: false,
    category_children: [],
    seo_meta: { focus_keyword: "erkek gömlek", seo_title: null, seo_description: null },
  }
  const rows = Array.from({ length: 20 }, (_, index) => ({
    id: `prod_${String(index)}`,
    title: `Gömlek ${String(index)}`,
  }))
  const brands = rows.map((row, index) => ({
    id: row.id,
    sales_channels: [{ id: "sc_1" }],
    brand:
      index < 8
        ? { name: "Alfa", is_active: true }
        : index < 14
          ? { name: "Beta", is_active: true }
          : index < 17
            ? { name: "Kapalı", is_active: false }
            : index < 19
              ? { name: "Gama", is_active: true }
              : null,
  }))

  it("names published products, the most frequent shown brands and a count range", async () => {
    const { container, asked, listed } = containerWith([[CATEGORY], brands], { rows, count: 47 })
    const facts = await categoryFacts(container, "pcat_1")

    expect(listed[0]?.filters).toEqual({ categories: { id: ["pcat_1"] }, status: "published" })
    expect(listed[0]?.config.select).toEqual([...CATEGORY_PRODUCT_FIELDS])
    expect(asked[1]).toMatchObject({
      entity: "product",
      filters: { id: rows.map((row) => row.id) },
    })
    const productNames = facts["products"]
    const names = typeof productNames === "string" ? productNames.split(", ") : []
    expect(names).toHaveLength(CATEGORY_PRODUCT_EXAMPLES)
    expect(names[0]).toBe("Gömlek 0")
    expect(facts).toMatchObject({
      brands: "Alfa, Beta, Gama",
      product_count: "40+ ürün",
      focus_keyword: "erkek gömlek",
    })
    for (const field of [...CATEGORY_PRODUCT_FIELDS, ...CATEGORY_BRAND_FIELDS]) {
      expect(field).not.toMatch(FORBIDDEN)
    }
    // The channel link's ids alone, to tell a product the storefront shows (B4)
    expect(asked[1]?.fields).toEqual([...CATEGORY_BRAND_FIELDS, CATEGORY_CHANNEL_FIELD])
    expect(CATEGORY_CHANNEL_FIELD).toBe("sales_channels.id")
  })

  it("names no product in no sales channel, nor its brand, and counts only the shown (B4)", async () => {
    const hidden = brands.map((row, index) =>
      index < 5
        ? { ...row, sales_channels: [] }
        : index < 8
          ? { ...row, sales_channels: null }
          : row
    )
    const { container } = containerWith([[CATEGORY], hidden], { rows, count: 20 })
    const facts = await categoryFacts(container, "pcat_1")
    const productNames = facts["products"]
    const names = typeof productNames === "string" ? productNames.split(", ") : []
    expect(names[0]).toBe("Gömlek 8")
    expect(names).not.toContain("Gömlek 0")
    expect(names).not.toContain("Gömlek 7")
    // Alfa's eight products are all hidden
    expect(facts).toMatchObject({ brands: "Beta, Gama", product_count: "10+ ürün" })

    const none = containerWith(
      [[CATEGORY], brands.map((row) => ({ ...row, sales_channels: [] }))],
      { rows, count: 20 }
    )
    expect(await categoryFacts(none.container, "pcat_1")).toMatchObject({
      products: null,
      brands: null,
      product_count: null,
    })
  })

  it("names only products in the storefront's channels, nothing without one (#247 D2)", async () => {
    // The first five are in another channel only: a wholesale or marketplace one
    const elsewhere = brands.map((row, index) =>
      index < 5 ? { ...row, sales_channels: [{ id: "sc_other" }] } : row
    )
    const { container } = containerWith([[CATEGORY], elsewhere], { rows, count: 20 })
    const listed = (await categoryFacts(container, "pcat_1"))["products"]
    const names = typeof listed === "string" ? listed.split(", ") : []
    expect(names[0]).toBe("Gömlek 5")
    expect(names).not.toContain("Gömlek 4")

    // No publishable key in use: the safe side, no name, brand or count, and no product read
    for (const keys of [
      [],
      [{ id: "apk_1", revoked_at: new Date(Date.now() - 1_000), sales_channels: [{ id: "sc_1" }] }],
      [{ id: "apk_1", revoked_at: null, sales_channels: [{ id: "sc_1", is_disabled: true }] }],
    ]) {
      const none = containerWith([[CATEGORY], brands], { rows, count: 20 }, keys)
      expect(await categoryFacts(none.container, "pcat_1")).toMatchObject({
        products: null,
        brands: null,
        product_count: null,
      })
      expect(none.asked).toHaveLength(1)
    }
  })

  it("reads the storefront's channels from its keys in use, never a key's token", async () => {
    const asked: Asked[] = []
    const later = new Date(Date.now() + 60_000)
    const container: FactsContainer = {
      resolve: () => ({
        graph: (request: Asked) => {
          asked.push(request)
          return Promise.resolve({
            data: [
              { id: "apk_1", revoked_at: null, sales_channels: [{ id: "sc_1" }, null] },
              // Revoked for later: Medusa still takes the key until then
              { id: "apk_2", revoked_at: later, sales_channels: [{ id: "sc_2" }] },
              { id: "apk_3", revoked_at: new Date(0), sales_channels: [{ id: "sc_3" }] },
            ],
          })
        },
      }),
    }
    expect([...(await storefrontChannelIds(container))].sort()).toEqual(["sc_1", "sc_2"])
    expect(asked).toEqual([
      { entity: "api_key", fields: [...STOREFRONT_KEY_FIELDS], filters: { type: "publishable" } },
    ])
    expect(STOREFRONT_KEY_FIELDS.join(",")).not.toMatch(/token|secret|redacted/)
  })

  it("estimates a large category's shown count from its sample", async () => {
    const half = brands.map((row, index) =>
      index % 2 === 0 ? row : { ...row, sales_channels: [] }
    )
    const { container } = containerWith([[CATEGORY], half], { rows, count: 300 })
    // 300 listed, half of the sample shown: about 150
    expect((await categoryFacts(container, "pcat_1"))["product_count"]).toBe("100+ ürün")
  })

  it("names nothing for a category with no published product", async () => {
    const { container, asked } = containerWith([[CATEGORY]])
    const facts = await categoryFacts(container, "pcat_1")
    expect(facts).toMatchObject({ products: null, brands: null, product_count: null })
    expect(asked).toHaveLength(1)
  })

  it("says how many as a range, never a large exact count", () => {
    expect(productCountLabel(0)).toBeNull()
    expect(productCountLabel(7)).toBe("7 ürün")
    expect(productCountLabel(12)).toBe("10+ ürün")
    expect(productCountLabel(99)).toBe("40+ ürün")
    expect(productCountLabel(130)).toBe("100+ ürün")
    expect(productCountLabel(4321)).toBe("500+ ürün")
  })
})
