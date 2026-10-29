import { normalizeSearchTerm } from "../terms"

describe("search terms", () => {
  it.each([
    ["  Şef   BIÇAĞI ", "şef bıçağı"],
    ["kupa 330 ml", "kupa 330 ml"],
    ["iPhone 15", "iphone 15"],
  ])("keeps %j as %j", (raw, term) => {
    expect(normalizeSearchTerm(raw)).toBe(term)
  })

  it.each([
    ["ayse.yilmaz@example.com"],
    ["0532 000 00 00"],
    ["+90 (532) 000-0000"],
    ["10000000146"],
    ["sipariş 123456"],
    ["https://rakip.example.com/urun"],
    ["a"],
    ["x".repeat(61)],
    ["kupa​"],
    [42],
    [undefined],
  ])("drops %j", (raw) => {
    expect(normalizeSearchTerm(raw)).toBeNull()
  })
})
