import { describe, expect, it } from "vitest"
import { filterQuery } from "./api/orders"
import { cleanSearch, filtersOf, isFiltered, orderListSearchSchema } from "./search"

const parse = (search: Record<string, unknown>) => orderListSearchSchema.parse(search)

describe("the order list's address", () => {
  it("reads an older link's single value as it is", () => {
    expect(
      parse({
        payment: "paid",
        shipping: "label",
        method: "cod",
        carrier: "aras",
        stage: "to_ship",
      })
    ).toMatchObject({
      payment: "paid",
      shipping: "label",
      method: "cod",
      carrier: "aras",
      stage: "to_ship",
    })
  })

  it("keeps several choices as a plain comma text, and joins a list written as one", () => {
    expect(parse({ payment: "paid,refunded", carrier: ["aras", "own"] })).toMatchObject({
      payment: "paid,refunded",
      carrier: "aras,own",
    })
  })

  it("drops unknown and repeated choices, and a text left empty", () => {
    const search = parse({ shipping: "label,lost,label", method: "cash", payment: 5 })

    expect(search.shipping).toBe("label")
    expect(search.method).toBeUndefined()
    expect(search.payment).toBeUndefined()
  })

  it("counts a filter only while it holds a choice", () => {
    expect(isFiltered({ payment: "" })).toBe(false)
    expect(isFiltered({ payment: "paid" })).toBe(true)
    expect(cleanSearch({ payment: "", carrier: "own,own", stage: "all", page: 1 })).toEqual({
      q: undefined,
      stage: undefined,
      payment: undefined,
      shipping: undefined,
      method: undefined,
      carrier: "own",
      from: undefined,
      to: undefined,
      page: undefined,
    })
  })

  it("splits the choices into lists, and sends them to the server as comma lists", () => {
    const filters = filtersOf(parse({ payment: "paid,refunded", shipping: "none" }))

    expect(filters).toMatchObject({ payment: ["paid", "refunded"], shipping: ["none"] })
    expect(filterQuery(filters)).toEqual({
      stage: "all",
      payment: "paid,refunded",
      shipping: "none",
    })
  })
})
