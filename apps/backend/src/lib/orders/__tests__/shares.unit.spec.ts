import { MathBN } from "@medusajs/framework/utils"
import { itemAmounts, lineShares } from ".."
import type { ItemFacts, LineAmounts } from ".."

const item = (
  id: string,
  unitPrice: number,
  quantity: number,
  discount: number | string,
  taxInclusive = true
): ItemFacts => ({
  id,
  quantity,
  unit_price: unitPrice,
  is_tax_inclusive: taxInclusive,
  tax_lines: [{ rate: 20 }],
  adjustments: [{ amount: discount, is_tax_inclusive: taxInclusive }],
})

const shipping = (id: string, amount: number): LineAmounts => ({
  id,
  kind: "shipping",
  quantity: 1,
  gross: amount,
  net: amount,
})

const kurusOf = (amount: Parameters<typeof MathBN.convert>[0] | undefined) =>
  Math.round(MathBN.convert(amount ?? Number.NaN).toNumber() * 100)

describe("itemAmounts", () => {
  it("takes a tax-inclusive line's price and payment as Medusa works them out", () => {
    // 10% off 3 × 33.33 is 9.999: Medusa keeps the digits below a kuruş
    const line = itemAmounts(item("a", 33.33, 3, "9.999"))
    expect(MathBN.convert(line.gross, 6).toNumber()).toBe(99.99)
    expect(MathBN.convert(line.net, 6).toNumber()).toBe(89.991)
  })

  it("adds the tax to a tax-exclusive line", () => {
    // 2 × 100 less 10 before tax, then 20% tax: 228 paid of 240
    const line = itemAmounts(item("b", 100, 2, 10, false))
    expect(MathBN.convert(line.gross, 6).toNumber()).toBe(240)
    expect(MathBN.convert(line.net, 6).toNumber()).toBe(228)
  })

  it("does not change a line that has no discount", () => {
    const line = itemAmounts({ id: "c", quantity: 2, unit_price: 45.5, is_tax_inclusive: true })
    expect(MathBN.convert(line.gross, 6).toNumber()).toBe(91)
    expect(MathBN.convert(line.net, 6).toNumber()).toBe(91)
  })
})

describe("lineShares", () => {
  it("turns exact shares into kuruş that add up to what the order charged (KK)", () => {
    const lines = [
      itemAmounts(item("a", 33.33, 3, "9.999")),
      itemAmounts(item("b", 20, 1, 2)),
      shipping("s", 49.9),
    ]
    expect(lineShares(lines)).toEqual([
      { id: "a", kind: "item", quantity: 3, gross: 9999, discount: 1000, net: 8999 },
      { id: "b", kind: "item", quantity: 1, gross: 2000, discount: 200, net: 1800 },
      { id: "s", kind: "shipping", quantity: 1, gross: 4990, discount: 0, net: 4990 },
    ])
  })

  it("rounds a half kuruş as Medusa charged it, not its division noise", () => {
    // 10% of 3 × 33.35 is 10.005; tax out and back in leaves 90.04499…988 inside
    // Medusa, which stores and charges 90.045
    const lines = [itemAmounts(item("a", 33.35, 3, "10.005")), shipping("s", 90)]
    expect(lineShares(lines)[0]).toMatchObject({ gross: 10005, discount: 1000, net: 9005 })
  })

  it("never discounts a line past its price", () => {
    // Prices below a kuruş: b's price rounds to 1 kuruş, but its exact share of
    // the 2-kuruş discount (the larger weight wins the tie) would be 2
    const lines: LineAmounts[] = [
      { id: "a", kind: "item", quantity: 1, gross: "0.015", net: "0.01" },
      { id: "b", kind: "item", quantity: 1, gross: "0.015", net: "0" },
    ]
    expect(lineShares(lines)).toEqual([
      { id: "a", kind: "item", quantity: 1, gross: 2, discount: 1, net: 1 },
      { id: "b", kind: "item", quantity: 1, gross: 1, discount: 1, net: 0 },
    ])
  })

  it("has nothing to share on an order without lines", () => {
    expect(lineShares([])).toEqual([])
  })

  it("adds up and stays within two kuruş of Medusa's exact amounts on random orders", () => {
    // Park–Miller: the same 500 orders on every run
    let seed = 47
    const next = (limit: number): number => {
      seed = (seed * 48_271) % 2_147_483_647
      return seed % limit
    }
    for (let run = 0; run < 500; run++) {
      const lines = Array.from({ length: 1 + next(5) }, (_, index) => {
        const unitPrice = (1 + next(50_000)) / 100
        const quantity = 1 + next(5)
        // A percentage off the line, as Medusa works it out: digits below a kuruş kept
        const discount = MathBN.mult(MathBN.mult(unitPrice, quantity), next(60) / 100)
        return itemAmounts(item(`i${String(index)}`, unitPrice, quantity, discount.toString()))
      })
      const shares = lineShares(lines)
      const exactNet = lines.reduce((sum, line) => MathBN.add(sum, line.net), MathBN.convert(0))

      expect(shares.reduce((sum, share) => sum + share.net, 0)).toBe(
        kurusOf(MathBN.convert(exactNet, 2))
      )
      shares.forEach((share, index) => {
        expect(share.gross).toBe(kurusOf(lines[index]?.gross))
        expect(share.discount).toBeGreaterThanOrEqual(0)
        expect(share.discount).toBeLessThanOrEqual(share.gross)
        const exact = MathBN.mult(lines[index]?.net ?? 0, 100).toNumber()
        expect(Math.abs(share.net - exact)).toBeLessThan(2)
      })
    }
  })
})
