import { sellable, stockSlice } from "../stock"

const item = (id: string, stocked: number, reserved = 0, second?: number) => ({
  id,
  location_levels: [
    { stocked_quantity: stocked, reserved_quantity: reserved },
    ...(second === undefined ? [] : [{ stocked_quantity: second, reserved_quantity: 0 }]),
  ],
})

const rows = [item("a", 50), item("b", 4), item("c", 3, 3), item("d", 2, 0, 1), item("e", 0)]

describe("stockSlice", () => {
  it("counts sellable stock across locations, less what is held", () => {
    expect(sellable(item("x", 10, 4, 3))).toBe(9)
    expect(sellable({ id: "y", location_levels: null })).toBe(0)
  })

  it("counts every view; low holds the sold-out ones too", () => {
    expect(stockSlice(rows, "all", 0, 20, () => 5).counts).toEqual({ all: 5, low: 4, out: 2 })
  })

  it("judges each item by its own threshold when it has one", () => {
    // "a" holds 50: low under its own threshold of 50
    expect(stockSlice(rows, "low", 0, 20, (id) => (id === "a" ? 50 : 5)).counts.low).toBe(5)
  })

  it("puts the emptiest first in low, and pages", () => {
    const low = stockSlice(rows, "low", 0, 20, () => 5)

    expect(low.page.map((row) => row.id)).toEqual(["c", "e", "d", "b"])
    expect(low.page[0]).toEqual({ id: "c", available: 0 })
    expect(stockSlice(rows, "all", 1, 2, () => 5).page.map((row) => row.id)).toEqual(["b", "c"])
  })
})
