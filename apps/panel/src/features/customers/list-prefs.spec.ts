import { describe, expect, it } from "vitest"
import { DEFAULT_HIDDEN, parseHidden } from "./list-prefs"

describe("customer list columns", () => {
  it("keeps only the columns the list knows, in its own order", () => {
    expect(parseHidden(["city", "phone", "orders"])).toEqual(["orders", "city"])
  })

  it("falls back to the defaults for anything else stored", () => {
    expect(parseHidden(null)).toEqual(DEFAULT_HIDDEN)
    expect(parseHidden({ hidden: ["city"] })).toEqual(DEFAULT_HIDDEN)
  })

  it("shows every column when the person hid none", () => {
    expect(parseHidden([])).toEqual([])
  })
})
