import { allocateKurus, kurus } from ".."

const allocate = (total: number, weights: number[]): number[] =>
  allocateKurus(kurus(total), weights)

describe("allocateKurus", () => {
  it.each([
    ["1 kuruş over three equal parts", 1, [1, 1, 1], [1, 0, 0]],
    ["100 kuruş over three equal parts", 100, [1, 1, 1], [34, 33, 33]],
    ["10 kuruş over four equal parts", 10, [1, 1, 1, 1], [3, 3, 2, 2]],
    ["exact proportions", 300, [100, 200], [100, 200]],
    // 2.86 / 7.14: the leftover goes to the larger remainder, not the larger weight
    ["largest remainder over largest weight", 10, [2, 5], [3, 7]],
    // 333.33 / 555.63 / 111.04: the leftover kuruş goes to the largest remainder
    ["discount over line totals", 1000, [2999, 4999, 999], [333, 556, 111]],
    ["a single line takes everything", 777, [5], [777]],
    ["zero total", 0, [3, 5], [0, 0]],
    ["a zero-weight line gets nothing", 10, [0, 1, 1], [0, 5, 5]],
  ])("%s", (_case, total, weights, expected) => {
    expect(allocate(total, weights)).toEqual(expected)
  })

  it("splits evenly when every weight is zero", () => {
    expect(allocate(10, [0, 0, 0])).toEqual([4, 3, 3])
  })

  it("gives the leftover to the larger weight when remainders tie", () => {
    // Exact shares 0.5 and 1.5: equal remainders, the heavier line wins
    expect(allocate(2, [1, 3])).toEqual([0, 2])
  })

  it("prefers the earlier line when remainder and weight both tie", () => {
    expect(allocate(1, [2, 2])).toEqual([1, 0])
  })

  it("keeps the sign of a negative total (refunds)", () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33])
    expect(allocate(-1, [1, 1]).every((part) => !Object.is(part, -0))).toBe(true)
  })

  it.each([
    ["no weights", []],
    ["a negative weight", [1, -1]],
    ["a fractional weight", [1, 0.5]],
  ])("rejects %s", (_case, weights) => {
    expect(() => allocate(10, weights)).toThrow(RangeError)
  })

  it("never gains or loses a kuruş and stays within one kuruş of the exact share", () => {
    // Park–Miller generator: the same 1000 cases on every run, and the
    // product stays below 2^53 so no step loses precision
    let seed = 20261024
    const next = (limit: number): number => {
      seed = (seed * 48_271) % 2_147_483_647
      return seed % limit
    }
    for (let run = 0; run < 1000; run++) {
      const total = next(2_000_000) - 1_000_000
      const weights = Array.from({ length: 1 + next(8) }, () => next(100_000))
      const parts = allocate(total, weights)
      const weightSum = weights.reduce((sum, weight) => sum + weight, 0)

      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total)
      parts.forEach((part, index) => {
        const exact =
          weightSum === 0 ? total / weights.length : (total * (weights[index] ?? 0)) / weightSum
        expect(Math.abs(part - exact)).toBeLessThan(1)
      })
    }
  })
})
