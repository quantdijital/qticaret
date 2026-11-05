import { shopRatingOf } from "../shop-rating"

describe("the shop's reviews in short (adr/0046 Ek 2026-11-05)", () => {
  const rows = [
    { product_id: "prod_a", rating: 5, count: 3 },
    { product_id: "prod_a", rating: 4, count: 1 },
    { product_id: "prod_b", rating: 2, count: 1 },
    // A draft's or another channel's product does not count
    { product_id: "prod_hidden", rating: 1, count: 7 },
  ]

  it("adds the shown products' stars up, the average to one decimal", () => {
    expect(shopRatingOf(rows, new Set(["prod_a", "prod_b"]))).toEqual({
      average: 4.2,
      count: 5,
      distribution: { "5": 3, "4": 1, "3": 0, "2": 1, "1": 0 },
    })
  })

  it("has none without an approved review the shopper may see", () => {
    expect(shopRatingOf(rows, new Set())).toBeNull()
    expect(shopRatingOf([], new Set(["prod_a"]))).toBeNull()
  })
})
