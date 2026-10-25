import { missingDimensions } from "../dimensions"

const FULL = { weight: 250, length: 30, width: 5, height: 2 }

describe("missingDimensions", () => {
  it("is satisfied by the product's values or the variant's own", () => {
    expect(missingDimensions(FULL)).toEqual([])
    expect(missingDimensions({}, FULL)).toEqual([])
    expect(missingDimensions({ weight: 250, length: 30 }, { width: 5, height: 2 })).toEqual([])
  })

  it("lets the variant's own value win over the product's, usable or not", () => {
    expect(missingDimensions(FULL, { weight: 0 })).toEqual(["weight"])
    expect(missingDimensions({ ...FULL, weight: null }, { weight: 300 })).toEqual([])
  })

  it("names every field without a positive number", () => {
    expect(missingDimensions({})).toEqual(["weight", "length", "width", "height"])
    expect(missingDimensions({ weight: 0, length: -1, width: Number.NaN, height: null })).toEqual([
      "weight",
      "length",
      "width",
      "height",
    ])
  })
})
