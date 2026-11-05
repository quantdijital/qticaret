import { describe, expect, it } from "vitest"
import { gtinProblem, normalizeGtin } from "./gtin"

describe("gtinProblem", () => {
  it.each([
    ["4006381333931", "GTIN-13"],
    ["8690000000005", "GTIN-13, Türkiye"],
    ["96385074", "GTIN-8"],
    ["036000291452", "GTIN-12 (UPC)"],
    ["10012345678902", "GTIN-14"],
    ["8 690000 000005", "typed in groups"],
    ["", "empty: a product may have none"],
  ])("takes %s (%s)", (code) => {
    expect(gtinProblem(code)).toBeNull()
  })

  it.each(["4006381333932", "8690000000001", "96385075"])(
    "says the check digit of %s does not fit",
    (code) => {
      expect(gtinProblem(code)).toBe("check")
    }
  )

  it.each(["123", "12345678901", "400638133393X", "RAF-25", "00000000", "123456789012345"])(
    "says %s is not a barcode",
    (code) => {
      expect(gtinProblem(code)).toBe("format")
    }
  )

  it("stores a code without its spaces", () => {
    expect(normalizeGtin(" 8 690000 000005 ")).toBe("8690000000005")
  })
})
