import { ZERO_KURUS, addKurus, kurus, multiplyByRateBps, subtractKurus, sumKurus } from ".."

describe("kurus", () => {
  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects %p",
    (value) => {
      expect(() => kurus(value)).toThrow(RangeError)
    }
  )

  it("accepts whole amounts, negative ones included, and normalises -0", () => {
    expect(kurus(2050)).toBe(2050)
    expect(kurus(-5)).toBe(-5)
    expect(Object.is(kurus(-0), 0)).toBe(true)
  })
})

describe("addition and subtraction", () => {
  it("add, subtract and sum exactly", () => {
    expect(addKurus(kurus(10), kurus(20))).toBe(30)
    expect(subtractKurus(kurus(10), kurus(25))).toBe(-15)
    expect(sumKurus([kurus(1), kurus(2), kurus(3)])).toBe(6)
    expect(sumKurus([])).toBe(ZERO_KURUS)
  })

  it("refuses a result beyond the safe integer range instead of losing precision", () => {
    const max = kurus(Number.MAX_SAFE_INTEGER)
    expect(() => addKurus(max, kurus(1))).toThrow(RangeError)
    expect(() => subtractKurus(kurus(-Number.MAX_SAFE_INTEGER), kurus(2))).toThrow(RangeError)
  })
})

describe("multiplyByRateBps", () => {
  it.each([
    ["20% of 1.000,00 TL", 100_000, 2000, 20_000],
    ["10% of 10,00 TL", 1000, 1000, 100],
    ["half a kuruş rounds up", 5, 1000, 1],
    ["half a kuruş below zero rounds away from zero", -5, 1000, -1],
    ["just under half rounds down", 4, 1000, 0],
    ["1.5 kuruş rounds to 2", 15, 1000, 2],
    ["zero rate", 12_345, 0, 0],
  ])("%s", (_case, amount, rateBps, expected) => {
    expect(multiplyByRateBps(kurus(amount), rateBps)).toBe(expected)
  })

  it("stays exact when amount × rate exceeds the safe integer range", () => {
    // Exactly ….5 kuruş, which rounds up to 2^52; float maths gives …495
    const max = kurus(Number.MAX_SAFE_INTEGER)
    expect(Math.round((max * 5000) / 10_000)).toBe(4_503_599_627_370_495)
    expect(multiplyByRateBps(max, 5000)).toBe(4_503_599_627_370_496)
  })

  it("rejects fractional basis points", () => {
    expect(() => multiplyByRateBps(kurus(100), 12.5)).toThrow(RangeError)
  })
})
