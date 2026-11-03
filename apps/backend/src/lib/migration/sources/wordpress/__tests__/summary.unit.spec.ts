import { wordpressRecords } from ".."
import { wxrFixture } from "./wxr"

describe("a WordPress run's summary block (adr/0042 Ek 2026-11-03)", () => {
  it("gives the descriptive attributes by slug and what does not move, each counted", () => {
    expect(wordpressRecords(wxrFixture()).summary).toEqual({
      // A global `pa_malzeme` and a product's own `malzeme` fill the same field: one entry
      attributes: [
        { key: "malzeme", name: "Malzeme", products: 2, values: 3 },
        { key: "desen", name: "Desen", products: 1, values: 1 },
      ],
      not_moved: { coupons: 1, menu_items: 1, product_tags: 1, blog_comments: 0 },
    })
  })

  it("says so when the export has none", () => {
    const bare = wxrFixture()
      .replace(/<item>[\s\S]*<\/item>/, "")
      .replace(/<wp:term>[\s\S]*<\/wp:term>/, "")
    expect(wordpressRecords(bare).summary).toEqual({
      attributes: [],
      not_moved: { coupons: 0, menu_items: 0, product_tags: 0, blog_comments: 0 },
    })
  })
})
