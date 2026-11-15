import { byName, lineMatches } from "../search"

const line = (
  product_title: string,
  variant_title: string | null = null,
  sku: string | null = null
) => ({
  product_title,
  variant_title,
  sku,
})

describe("finding a wholesale line (ADR-0068 §4)", () => {
  it("finds every word in the product, the variant or the SKU, Turkish case folded", () => {
    const knife = line("Şef Bıçağı", "20 cm", "SB-20")
    expect(lineMatches(knife, "şef")).toBe(true)
    expect(lineMatches(knife, "ŞEF  20")).toBe(true)
    expect(lineMatches(knife, "BIÇAĞI")).toBe(true)
    expect(lineMatches(knife, "sb-20")).toBe(true)
    expect(lineMatches(knife, "şef 30")).toBe(false)
  })

  it("finds everything with no words", () => {
    expect(lineMatches(line("Tahta"), undefined)).toBe(true)
    expect(lineMatches(line("Tahta"), "   ")).toBe(true)
  })

  it("orders by product, then variant name", () => {
    const lines = [line("Tahta", "Büyük"), line("Çakı"), line("Tahta", "Ana")]
    expect([...lines].sort(byName)).toEqual([
      line("Çakı"),
      line("Tahta", "Ana"),
      line("Tahta", "Büyük"),
    ])
  })
})
