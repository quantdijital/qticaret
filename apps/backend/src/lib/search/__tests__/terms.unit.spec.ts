import { normalizeSearchTerm } from "../terms"

describe("search terms", () => {
  it.each([
    ["  Şef   BIÇAĞI ", "şef bıçağı"],
    ["kupa 330 ml", "kupa 330 ml"],
    ["iPhone 15", "iphone 15"],
    ["ＫＵＰＡ ２", "kupa 2"],
    ["iphone 15 128 gb", "iphone 15 128 gb"],
    ["90 cm masa", "90 cm masa"],
  ])("keeps %j as %j", (raw, term) => {
    expect(normalizeSearchTerm(raw)).toBe(term)
  })

  it.each([
    ["ayse.yilmaz@example.com"],
    ["0532 000 00 00"],
    ["+90 (532) 000-0000"],
    ["10000000146"],
    ["sipariş 123456"],
    ["0532/000/00/00"],
    ["0532_000_00_00"],
    ["０５３２ ０００ ００ ００"],
    ["٠٥٣٢٠٠٠٠٠٠٠"],
    ["ayse @ example.com"],
    ["ayse＠example.com"],
    ["34 abc 123"],
    ["06AB1234"],
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
