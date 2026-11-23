import { listingResult, listingStatement } from "../sql/listing"
import { Statement } from "../sql/statement"
import type { ListingPlan } from "../types"

const plan = (over: Partial<ListingPlan> = {}): ListingPlan => ({
  channels: ["sc_1"],
  scope: {},
  text: null,
  filters: { brands: null, options: [], in_stock: false },
  price: { key: "reg_1:try", min: null, max: null },
  sort: "newest",
  page: { offset: 0, limit: 24 },
  ...over,
})

const placeholders = (sql: string) => sql.split("?").length - 1

describe("the listing statement (adr/0056)", () => {
  it("binds values in the order they stand, whatever order they were made in", () => {
    const sql = new Statement()
    const later = sql.param("b")
    const first = sql.param("a")
    expect(sql.finish(`SELECT ${first}, ${later}, ${first}`)).toEqual({
      sql: "SELECT ?, ?, ?",
      params: ["a", "b", "a"],
    })
  })

  it("writes no value into the text: what a shopper typed only binds", () => {
    const { sql, params } = listingStatement(
      plan({
        scope: { category_ids: ["pcat_1"], option: "renk=mavi" },
        text: {
          match: "'x''; DROP TABLE search_document; --'",
          units: [[{ query: "'x''; DROP TABLE search_document; --'", weight: 1 }]],
          phrase: "x'; drop",
        },
        filters: {
          brands: ["atolye"],
          options: [{ key: "malzeme", values: ["seramik"] }],
          in_stock: true,
        },
        price: { key: "reg_1:try", min: 10, max: 500 },
        sort: "relevance",
        related: 48,
      })
    )
    expect(sql).not.toContain("DROP")
    expect(sql).not.toContain("atolye")
    expect(sql).not.toContain("reg_1")
    expect(placeholders(sql)).toBe(params.length)
    expect(params).toContain("x'; drop")
    expect(params).toContain(JSON.stringify(["malzeme=seramik"]))
    // A filtered key's values are counted without its own filter
    expect(sql).toContain("AS own0")
    expect(sql).toContain("ts_rank(")
  })

  it("answers nothing for a scope with no categories or products, and only a count when asked", () => {
    const { sql } = listingStatement(plan({ scope: { category_ids: [], product_ids: [] } }))
    expect(sql).toContain("AND false")
    const count = listingStatement(plan({ countOnly: true, channels: null }))
    expect(count.sql).not.toContain("AS ids")
    expect(count.sql).not.toContain("sales_channel_ids")
  })

  it("answers only the count and the ids when asked, the page at most 1000 long", () => {
    const { sql, params } = listingStatement(
      plan({ idsOnly: true, page: { offset: 0, limit: 5000 } })
    )
    expect(sql).toContain("AS ids")
    expect(sql).not.toContain("AS brands")
    expect(sql).not.toContain("AS options")
    expect(sql).not.toContain("AS in_stock")
    expect(params).toContain(1000)
    expect(params).not.toContain(5000)
    expect(placeholders(sql)).toBe(params.length)
  })

  it("reads the statement's row into the answer", () => {
    const filtered = plan({
      filters: { brands: null, options: [{ key: "renk", values: ["mavi"] }], in_stock: false },
    })
    expect(
      listingResult(filtered, {
        count: 2,
        ids: ["p1", "p2"],
        brands: [["atolye", "Atölye", 2]],
        options: { "renk=mavi": 2 },
        own0: { "renk=mavi": 2, "renk=kirmizi": 1 },
        in_stock: 1,
        price: [10.5, 99],
        related: null,
      })
    ).toEqual({
      count: 2,
      ids: ["p1", "p2"],
      brands: [{ handle: "atolye", name: "Atölye", count: 2 }],
      options: [{ value: "renk=mavi", count: 2 }],
      ownOptions: {
        renk: [
          { value: "renk=mavi", count: 2 },
          { value: "renk=kirmizi", count: 1 },
        ],
      },
      inStock: 1,
      price: { min: 10.5, max: 99 },
      related: null,
    })
    expect(listingResult(filtered, undefined).count).toBe(0)
    expect(listingResult(plan(), { count: 0, price: [null, null] }).price).toBeNull()
  })

  it("orders by the ids given, the others after, newest first (adr/0077 §2)", () => {
    const { sql, params } = listingStatement(
      plan({ sort: "ids_order", order_ids: ["prod_b", "prod_a"] })
    )
    expect(sql).toContain("array_position(")
    expect(sql).toContain("ord_at ASC NULLS LAST, created_at DESC, product_id")
    expect(params).toContain(JSON.stringify(["prod_b", "prod_a"]))
    expect(placeholders(sql)).toBe(params.length)
    // Any other sort keeps its statement as before: no position worked out
    expect(listingStatement(plan()).sql).not.toContain("array_position")
  })
})
