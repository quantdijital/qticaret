import { categoryProductCounts } from "../category-counts"

describe("categoryProductCounts", () => {
  it("counts each category's products and those below it, each product once", () => {
    expect(
      categoryProductCounts([
        { id: "knives", parent_category_id: null, products: [{ id: "p1" }] },
        {
          id: "chef",
          parent_category_id: "knives",
          products: [{ id: "p1" }, { id: "p2" }, null],
        },
        { id: "santoku", parent_category_id: "chef", products: [{ id: "p3" }] },
        { id: "boards", parent_category_id: null, products: [] },
        { id: "empty", parent_category_id: "boards" },
      ])
    ).toEqual({ knives: 3, chef: 3, santoku: 1, boards: 0, empty: 0 })
  })
})
