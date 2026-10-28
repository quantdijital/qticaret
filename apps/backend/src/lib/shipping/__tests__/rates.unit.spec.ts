import { tablePrice } from "../rates"

const table = [
  { max_desi: 2, price: 5_000 },
  { max_desi: 5, price: 7_500 },
  { max_desi: 10, price: 12_000 },
]

describe("tablePrice (F7.8)", () => {
  it("takes the first band that holds the parcel", () => {
    expect(tablePrice(table, 0, 0.5)).toBe(5_000)
    expect(tablePrice(table, 0, 2)).toBe(5_000)
    expect(tablePrice(table, 0, 2.1)).toBe(7_500)
    expect(tablePrice(table, 0, 10)).toBe(12_000)
  })

  it("adds the per-desi price past the last band, or offers nothing without one", () => {
    expect(tablePrice(table, 900, 12.5)).toBe(12_000 + 3 * 900)
    expect(tablePrice(table, 0, 12.5)).toBeNull()
    expect(tablePrice([], 900, 1)).toBeNull()
  })
})
