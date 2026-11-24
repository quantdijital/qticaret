import { nextLinkedIds, templatesLinkedBy } from "../product-links"

describe("a product's add-on template links (adr/0052 Ek 2026-11-23)", () => {
  it("applies bulk edit's one change to the links as they are, keeping one made meanwhile", () => {
    // The bulk plan saw none; the product page linked adtpl_b before the write
    const now = ["adtpl_b"]
    expect(nextLinkedIds(now, { product_id: "p", add: "adtpl_a" })).toEqual(["adtpl_b", "adtpl_a"])
    expect(nextLinkedIds(["adtpl_a", "adtpl_b"], { product_id: "p", remove: "adtpl_a" })).toEqual([
      "adtpl_b",
    ])
    expect(nextLinkedIds(now, { product_id: "p", add: "adtpl_b" })).toEqual(["adtpl_b"])
  })

  it("takes the product page's whole list as it is", () => {
    expect(nextLinkedIds(["adtpl_a"], { product_id: "p", template_ids: ["adtpl_c"] })).toEqual([
      "adtpl_c",
    ])
  })

  it("locks every template a write may link, sorted; an unlink locks none", () => {
    expect(templatesLinkedBy({ product_id: "p", template_ids: ["adtpl_b", "adtpl_a"] })).toEqual([
      "adtpl_a",
      "adtpl_b",
    ])
    expect(templatesLinkedBy({ product_id: "p", add: "adtpl_c" })).toEqual(["adtpl_c"])
    expect(templatesLinkedBy({ product_id: "p", remove: "adtpl_c" })).toEqual([])
  })
})
