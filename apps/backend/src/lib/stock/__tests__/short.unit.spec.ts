import { shortLinesText, shortUnits, stockShortOf, stockShortfall } from "../short"
import type { CartStockLine } from "../short"

const line = (overrides: Partial<CartStockLine> = {}): CartStockLine => ({
  variant_id: "variant_kahve",
  quantity: 1,
  title: "Chuby / Kahverengi",
  sku: "CHB-KHV",
  tracked: true,
  ...overrides,
})

describe("stockShortfall (adr/0026 Ek 2026-11-06)", () => {
  it("finds the units the shelf has none for, a variant on two lines counted once", () => {
    const short = stockShortfall(
      [line(), line({ quantity: 2 }), line({ variant_id: "variant_mavi", title: "Chuby / Mavi" })],
      { variant_kahve: 1, variant_mavi: 5 }
    )

    expect(short).toEqual([
      {
        variant_id: "variant_kahve",
        title: "Chuby / Kahverengi",
        sku: "CHB-KHV",
        quantity: 3,
        short: 2,
      },
    ])
  })

  it("counts a variant missing from the availability, or below zero, as having none", () => {
    expect(stockShortfall([line({ quantity: 2 })], {})).toMatchObject([{ short: 2 }])
    expect(stockShortfall([line({ quantity: 2 })], { variant_kahve: -3 })).toMatchObject([
      { short: 2 },
    ])
  })

  it("never names a line that is not tracked, sells past the shelf, or has no variant", () => {
    expect(
      stockShortfall([line({ tracked: false }), line({ variant_id: null, quantity: 4 })], {})
    ).toEqual([])
  })
})

describe("stockShortOf", () => {
  it("reads the order's mark and ignores one that is not whole", () => {
    const mark = {
      lines: [
        { variant_id: "v1", title: "Chuby / Kahverengi", sku: null, quantity: 2, short: 1 },
        { variant_id: "v2", title: "Bozuk", quantity: "1", short: 1 },
      ],
      at: "2026-11-06T10:00:00.000Z",
    }
    const short = stockShortOf({ stock_short: mark, other: true })

    expect(short).toEqual({ lines: [mark.lines[0]], at: mark.at })
    expect(short && shortLinesText(short)).toBe("Chuby / Kahverengi ×1")
    expect(shortUnits(short)).toBe(1)
    expect(stockShortOf({ stock_short: { lines: [] } })).toBeNull()
    expect(stockShortOf({ stock_short: "yes" })).toBeNull()
    expect(stockShortOf(null)).toBeNull()
    expect(shortUnits(null)).toBe(0)
  })
})
