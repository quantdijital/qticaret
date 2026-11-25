import { defaultParseSearch } from "@tanstack/react-router"
import { describe, expect, it } from "vitest"
import { stringifySearch } from "./search-params"

describe("the router's address text", () => {
  it("leaves a comma list readable, and reads it back the same", () => {
    const text = stringifySearch({ payment: "paid,refunded", stage: "to_ship", page: 2 })

    expect(text).toBe("?payment=paid,refunded&stage=to_ship&page=2")
    expect(defaultParseSearch(text)).toEqual({
      payment: "paid,refunded",
      stage: "to_ship",
      page: 2,
    })
  })

  it("still escapes what a query would misread", () => {
    expect(stringifySearch({ q: "a&b=c" })).toBe("?q=a%26b%3Dc")
  })
})
