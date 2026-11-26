import {
  MAX_LINKED_PRODUCTS,
  linkedProductIdsInput,
  mergeLinked,
  storedLinkedIds,
} from "../linked-products"

describe("linked products (S3)", () => {
  it("merges several products' lists in order, each once, none of the products themselves", () => {
    expect(
      mergeLinked(
        [
          ["prod_b", "prod_a", "prod_c"],
          ["prod_c", "prod_d", "prod_x"],
        ],
        new Set(["prod_a", "prod_x"])
      )
    ).toEqual(["prod_b", "prod_c", "prod_d"])
    expect(mergeLinked([], new Set())).toEqual([])
  })

  it("reads a stored list, anything else as none", () => {
    expect(storedLinkedIds(["prod_a", 4, "prod_b"])).toEqual(["prod_a", "prod_b"])
    expect(storedLinkedIds(null)).toEqual([])
    expect(storedLinkedIds("prod_a")).toEqual([])
  })

  it("takes product ids, each once, twelve at most", () => {
    expect(linkedProductIdsInput.safeParse(["prod_a", "prod_b"]).success).toBe(true)
    expect(linkedProductIdsInput.safeParse([]).success).toBe(true)
    expect(linkedProductIdsInput.safeParse(["prod_a", "prod_a"]).success).toBe(false)
    expect(linkedProductIdsInput.safeParse(["variant_a"]).success).toBe(false)
    const many = Array.from({ length: MAX_LINKED_PRODUCTS + 1 }, (_, i) => `prod_${String(i)}`)
    expect(linkedProductIdsInput.safeParse(many).success).toBe(false)
    expect(linkedProductIdsInput.safeParse(many.slice(1)).success).toBe(true)
  })
})
