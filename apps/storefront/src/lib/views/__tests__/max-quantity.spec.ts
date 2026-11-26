import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import { maxQuantityOf } from "../product"

const product = (max: unknown): StoreProduct =>
  ({ id: "prod_1", title: "Bıçak", product_extension: { max_quantity: max } }) as StoreProduct

describe("a product's most per order on its page (S5)", () => {
  it("passes a whole number from 1 on to the view", () => {
    expect(maxQuantityOf(product(1))).toEqual({ maxQuantity: 1 })
    expect(maxQuantityOf(product(12))).toEqual({ maxQuantity: 12 })
  })

  it("leaves it out without one, so the page is drawn as before", () => {
    for (const none of [null, undefined, 0, 1.5, "3"]) {
      expect(maxQuantityOf(product(none))).toEqual({})
    }
    expect(maxQuantityOf({ id: "prod_2", title: "Önlük" } as StoreProduct)).toEqual({})
  })
})
