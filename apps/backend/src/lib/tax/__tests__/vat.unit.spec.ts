import {
  hasVatPrecision,
  sameVatRate,
  vatCodeOf,
  vatNameKey,
  vatNameOf,
  vatPercentText,
} from "../vat"

describe("KDV rate values", () => {
  it("names a rate as a Turkish reader writes it", () => {
    expect(vatNameOf(10)).toBe("KDV %10")
    expect(vatNameOf(8.5)).toBe("KDV %8,5")
    expect(vatNameOf(0.25)).toBe("KDV %0,25")
    expect(vatNameOf(0)).toBe("KDV %0")
    expect(vatPercentText(20)).toBe("20")
  })

  it("takes at most two decimals and compares in hundredths", () => {
    expect(hasVatPrecision(8.5)).toBe(true)
    expect(hasVatPrecision(0.01)).toBe(true)
    expect(hasVatPrecision(18.125)).toBe(false)
    expect(hasVatPrecision(Number.NaN)).toBe(false)
    expect(sameVatRate(0.1 + 0.2, 0.3)).toBe(true)
    expect(sameVatRate(10, 10.01)).toBe(false)
  })

  it("codes a rate by its percentage, numbered while the code is taken", () => {
    expect(vatCodeOf(10, [])).toBe("KDV10")
    expect(vatCodeOf(8.5, ["KDV20", null])).toBe("KDV8_5")
    expect(vatCodeOf(10, ["kdv10"])).toBe("KDV10_2")
    expect(vatCodeOf(10, ["KDV10", "KDV10_2"])).toBe("KDV10_3")
  })

  it("compares names as people read them", () => {
    expect(vatNameKey("  KDV   %10 ")).toBe(vatNameKey("kdv %10"))
    expect(vatNameKey("İndirimli")).toBe(vatNameKey("indirimli"))
  })
})
