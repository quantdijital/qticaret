import { isValidGtin, variantGtin } from "../gtin"

describe("isValidGtin", () => {
  it.each([
    ["EAN-13", "4006381333931"],
    ["UPC-A (GTIN-12)", "036000291452"],
    ["EAN-8", "96385074"],
    ["GTIN-14", "10614141000415"],
  ])("accepts a valid %s", (_kind, code) => {
    expect(isValidGtin(code)).toBe(true)
  })

  it.each([
    ["a wrong check digit", "4006381333932"],
    ["a length GS1 does not use", "4006381333"],
    ["a letter", "400638133393a"],
    ["spaces", "4006381 333931"],
    ["all zeros, whose check digit adds up", "0000000000000"],
    ["nothing", ""],
  ])("refuses %s", (_label, code) => {
    expect(isValidGtin(code)).toBe(false)
  })
})

describe("variantGtin", () => {
  it("takes the first valid code in the order ean, upc, barcode", () => {
    expect(variantGtin({ ean: "4006381333931", upc: "036000291452" })).toBe("4006381333931")
    expect(variantGtin({ ean: "4006381333932", upc: "036000291452" })).toBe("036000291452")
    expect(variantGtin({ ean: null, upc: null, barcode: " 96385074 " })).toBe("96385074")
  })

  it("answers null when no code is a GTIN (an in-house barcode)", () => {
    expect(variantGtin({ barcode: "RAF-12-B" })).toBeNull()
    expect(variantGtin({})).toBeNull()
  })
})
