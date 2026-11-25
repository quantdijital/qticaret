import { describe, expect, it } from "vitest"
import { filterQuery } from "./api/orders"
import { cleanSearch, filtersOf, isFiltered, orderListSearchSchema } from "./search"

const parse = (search: Record<string, unknown>) => orderListSearchSchema.parse(search)

describe("the order list's address", () => {
  it("reads an older link's single value as one choice", () => {
    expect(
      parse({
        payment: "paid",
        shipping: "label",
        method: "cod",
        carrier: "aras",
        stage: "to_ship",
      })
    ).toMatchObject({
      payment: ["paid"],
      shipping: ["label"],
      method: ["cod"],
      carrier: ["aras"],
      stage: "to_ship",
    })
  })

  it("reads lists, and a comma list typed by hand", () => {
    expect(parse({ payment: ["paid", "refunded"], carrier: "aras,own" })).toMatchObject({
      payment: ["paid", "refunded"],
      carrier: ["aras", "own"],
    })
  })

  it("drops unknown and repeated choices, and a list left empty", () => {
    const search = parse({ shipping: ["label", "lost", "label"], method: ["cash"], payment: 5 })

    expect(search.shipping).toEqual(["label"])
    expect(search.method).toBeUndefined()
    expect(search.payment).toBeUndefined()
  })

  it("counts a list as a filter only while it holds a choice", () => {
    expect(isFiltered({ payment: [] })).toBe(false)
    expect(isFiltered({ payment: ["paid"] })).toBe(true)
    expect(cleanSearch({ payment: [], carrier: ["own"], stage: "all", page: 1 })).toEqual({
      q: undefined,
      stage: undefined,
      payment: undefined,
      shipping: undefined,
      method: undefined,
      carrier: ["own"],
      from: undefined,
      to: undefined,
      page: undefined,
    })
  })

  it("sends the choices to the server as comma lists", () => {
    const filters = filtersOf(parse({ payment: ["paid", "refunded"], shipping: "none" }))

    expect(filterQuery(filters)).toEqual({
      stage: "all",
      payment: "paid,refunded",
      shipping: "none",
    })
  })
})
