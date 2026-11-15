import {
  AdminGetWholesaleLines,
  AdminPostWholesalePrices,
  AdminPostWholesaleTier,
  AdminUpdateWholesaleTier,
} from "../validators"

describe("wholesale level bodies (ADR-0068)", () => {
  it("takes a name, and a rate and minimum or none", () => {
    expect(AdminPostWholesaleTier.parse({ name: "  Toptan A " })).toEqual({
      name: "Toptan A",
      percent: null,
      min_quantity: null,
    })
    expect(
      AdminPostWholesaleTier.parse({ name: "Toptan B", percent: 12.5, min_quantity: 10 })
    ).toEqual({ name: "Toptan B", percent: 12.5, min_quantity: 10 })
  })

  it("refuses a rate out of bounds or past two decimals, a minimum of none, other fields", () => {
    for (const body of [
      { name: "" },
      { name: "A", percent: 0 },
      { name: "A", percent: 99.5 },
      { name: "A", percent: 12.345 },
      { name: "A", min_quantity: 0 },
      { name: "A", min_quantity: 2.5 },
      { name: "A", customer_group_id: "cusgroup_x" },
      { name: "A", price_list_id: "plist_x" },
    ]) {
      expect(AdminPostWholesaleTier.safeParse(body).success).toBe(false)
    }
  })

  it("changes a level by any field, null taking a rate or minimum away, never by nothing", () => {
    expect(AdminUpdateWholesaleTier.parse({ percent: null })).toEqual({ percent: null })
    expect(AdminUpdateWholesaleTier.parse({ min_quantity: 5 })).toEqual({ min_quantity: 5 })
    expect(AdminUpdateWholesaleTier.safeParse({}).success).toBe(false)
  })
})

describe("a page of a level's lines", () => {
  it("reads limit and offset from the query string, 50 from the start by default", () => {
    expect(AdminGetWholesaleLines.parse({})).toEqual({ limit: 50, offset: 0 })
    expect(AdminGetWholesaleLines.parse({ limit: "2", offset: "4", q: " bıçak " })).toEqual({
      limit: 2,
      offset: 4,
      q: "bıçak",
    })
  })

  it("refuses a page past 200, a negative offset, a long search and other filters", () => {
    for (const query of [
      { limit: "201" },
      { limit: "0" },
      { offset: "-1" },
      { q: "x".repeat(101) },
      { price_list_id: "plist_x" },
    ]) {
      expect(AdminGetWholesaleLines.safeParse(query).success).toBe(false)
    }
  })
})

describe("hand-entered wholesale prices", () => {
  it("takes net lira amounts as Medusa writes them, and variants to remove", () => {
    expect(
      AdminPostWholesalePrices.parse({ set: [{ variant_id: "variant_1", net: "1250.50" }] })
    ).toEqual({ set: [{ variant_id: "variant_1", net: "1250.50" }], remove: [] })
    expect(AdminPostWholesalePrices.parse({ remove: ["variant_1"] })).toEqual({
      set: [],
      remove: ["variant_1"],
    })
  })

  it("refuses no change, zero, kuruş fractions, numbers, a variant twice and a price list id", () => {
    for (const body of [
      {},
      { set: [{ variant_id: "v", net: "0" }] },
      { set: [{ variant_id: "v", net: "0.00" }] },
      { set: [{ variant_id: "v", net: "1.005" }] },
      { set: [{ variant_id: "v", net: "-1" }] },
      { set: [{ variant_id: "v", net: "1e3" }] },
      { set: [{ variant_id: "v", net: 10 }] },
      { set: [{ variant_id: "v", net: "10" }], remove: ["v"] },
      { set: [{ variant_id: "v", net: "10", price_list_id: "plist_x" }] },
      { set: Array.from({ length: 101 }, (_, i) => ({ variant_id: `v${String(i)}`, net: "1" })) },
    ]) {
      expect(AdminPostWholesalePrices.safeParse(body).success).toBe(false)
    }
  })
})
