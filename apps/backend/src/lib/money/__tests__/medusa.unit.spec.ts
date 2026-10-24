import { BigNumber } from "@medusajs/framework/utils"
import { fromMedusaAmount, kurus, toMedusaAmount } from ".."

describe("fromMedusaAmount", () => {
  it.each([
    ["a number", 20.5],
    ["a string", "20.50"],
    ["a raw amount as stored by Medusa", { value: "20.500000000000000000", precision: 20 }],
    ["a BigNumber", new BigNumber("20.50")],
  ])("reads %s in lira as kuruş", (_case, value) => {
    expect(fromMedusaAmount(value)).toBe(2050)
  })

  it("does not pick up float noise from number input", () => {
    // 0.1 + 0.2 as a double is 0.30000000000000004
    expect(() => fromMedusaAmount(0.1 + 0.2)).toThrow(RangeError)
    expect(fromMedusaAmount(0.3)).toBe(30)
    expect(fromMedusaAmount(1234567.89)).toBe(123_456_789)
  })

  it("refuses digits below a kuruş unless rounding is allowed, then rounds half-up", () => {
    expect(() => fromMedusaAmount("0.005")).toThrow(RangeError)
    expect(fromMedusaAmount("0.005", { allowRounding: true })).toBe(1)
    expect(fromMedusaAmount("0.004", { allowRounding: true })).toBe(0)
    expect(fromMedusaAmount("-2.345", { allowRounding: true })).toBe(-235)
    expect(Object.is(fromMedusaAmount("-0.001", { allowRounding: true }), 0)).toBe(true)
  })

  it.each([
    ["null (MathBN would read 0)", null],
    ["undefined (MathBN would read 0)", undefined],
    ["a hex string (MathBN would read 16)", "0x10"],
    ["an exponent string (MathBN would read 100)", "1e2"],
    ["a padded string", " 12.5 "],
    ["a comma decimal", "12,50"],
    ["text", "not a number"],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("rejects %s", (_case, value) => {
    expect(() => fromMedusaAmount(value as never)).toThrow(RangeError)
  })
})

describe("toMedusaAmount", () => {
  it.each([
    [2050, "20.50"],
    [5, "0.05"],
    [-5, "-0.05"],
    [0, "0.00"],
    [100_000, "1000.00"],
    [Number.MAX_SAFE_INTEGER, "90071992547409.91"],
  ])("writes %p kuruş as %p", (amount, expected) => {
    expect(toMedusaAmount(kurus(amount))).toBe(expected)
  })

  it("round-trips through Medusa's representation", () => {
    for (const amount of [0, 1, 99, 2050, -12_345, 987_654_321]) {
      expect(fromMedusaAmount(toMedusaAmount(kurus(amount)))).toBe(amount)
    }
  })
})
