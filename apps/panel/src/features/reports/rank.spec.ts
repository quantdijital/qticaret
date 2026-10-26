import { describe, expect, it } from "vitest"
import { rankedProducts } from "./rank"

const product = (title: string, units: number, sales: string) => ({
  product_id: title,
  title,
  thumbnail: null,
  units,
  sales,
})

const PRODUCTS = [
  product("Seramik Kupa", 23, "5727.00"),
  product("Pamuklu Tişört", 18, "7182.00"),
  product("Işıklı Kalem", 3, "90.00"),
]

describe("rankedProducts", () => {
  it("ranks by sales, or by units, with what one unit sold for", () => {
    expect(rankedProducts(PRODUCTS, "sales", "").map((row) => [row.title, row.rank])).toEqual([
      ["Pamuklu Tişört", 1],
      ["Seramik Kupa", 2],
      ["Işıklı Kalem", 3],
    ])
    const byUnits = rankedProducts(PRODUCTS, "units", "")
    expect(byUnits[0]).toMatchObject({ title: "Seramik Kupa", rank: 1 })
    expect(byUnits[2]?.average).toBe(30)
  })

  it("keeps a product's rank when a search narrows the list, Turkish letters read as typed", () => {
    expect(rankedProducts(PRODUCTS, "sales", "ışık")).toEqual([
      expect.objectContaining({ title: "Işıklı Kalem", rank: 3 }),
    ])
    expect(rankedProducts(PRODUCTS, "sales", "  TİŞÖRT ")).toEqual([
      expect.objectContaining({ title: "Pamuklu Tişört", rank: 1 }),
    ])
  })
})
