import { allocateCappedKurus, kurus, prorateKurus, weightOfMedusaAmount } from ".."

const capped = (total: number, weights: number[], caps: number[]): number[] =>
  allocateCappedKurus(
    kurus(total),
    weights,
    caps.map((cap) => kurus(cap))
  )

describe("allocateCappedKurus", () => {
  it.each([
    ["under every cap, as the plain split", 100, [1, 1, 1], [100, 100, 100], [34, 33, 33]],
    ["a part at its cap passes the rest on", 100, [1, 1], [10, 200], [10, 90]],
    ["the rest goes by weight", 100, [2, 1, 1], [10, 200, 200], [10, 45, 45]],
    ["everything the caps allow", 30, [1, 1, 1], [10, 10, 10], [10, 10, 10]],
    ["a part with no room gets nothing", 10, [5, 1], [0, 20], [0, 10]],
    ["caps that pass on in rounds", 90, [10, 5, 1], [10, 20, 100], [10, 20, 60]],
    ["zero total", 0, [1, 1], [5, 5], [0, 0]],
    ["zero weights split evenly within caps", 10, [0, 0], [3, 20], [3, 7]],
  ])("%s", (_case, total, weights, caps, expected) => {
    expect(capped(total, weights, caps)).toEqual(expected)
  })

  it.each([
    ["more than the caps allow", 31, [1, 1, 1], [10, 10, 10]],
    ["a negative total", -1, [1], [5]],
    ["a negative cap", 1, [1, 1], [5, -1]],
    ["a missing cap", 1, [1, 1], [5]],
  ])("rejects %s", (_case, total, weights, caps) => {
    expect(() => capped(total, weights, caps)).toThrow(RangeError)
  })

  it("never passes a cap and never gains or loses a kuruş", () => {
    // Park–Miller: the same 1000 cases on every run
    let seed = 20261026
    const next = (limit: number): number => {
      seed = (seed * 48_271) % 2_147_483_647
      return seed % limit
    }
    for (let run = 0; run < 1000; run++) {
      const size = 1 + next(8)
      const caps = Array.from({ length: size }, () => next(50_000))
      const weights = Array.from({ length: size }, () => next(100_000))
      const total = next(caps.reduce((sum, cap) => sum + cap, 0) + 1)
      const parts = capped(total, weights, caps)

      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total)
      parts.forEach((part, index) => {
        expect(part).toBeGreaterThanOrEqual(0)
        expect(part).toBeLessThanOrEqual(caps[index] ?? 0)
      })
    }
  })
})

describe("prorateKurus", () => {
  it.each([
    ["a third, rounded down", 1000, 1, 3, 333],
    ["two thirds, rounded up", 1000, 2, 3, 667],
    ["the whole", 1000, 3, 3, 1000],
    ["none", 1000, 0, 3, 0],
    ["a half kuruş rounds up", 1, 1, 2, 1],
  ])("%s", (_case, amount, part, whole, expected) => {
    expect(prorateKurus(kurus(amount), part, whole)).toBe(expected)
  })

  it("steps that always add up to the amount", () => {
    for (const whole of [1, 2, 3, 7, 13]) {
      for (const amount of [0, 1, 2, 999, 8999, 100_001]) {
        const steps = Array.from(
          { length: whole },
          (_, unit) =>
            prorateKurus(kurus(amount), unit + 1, whole) - prorateKurus(kurus(amount), unit, whole)
        )
        expect(steps.reduce((sum, step) => sum + step, 0)).toBe(amount)
        expect(Math.max(...steps) - Math.min(...steps)).toBeLessThanOrEqual(1)
      }
    }
  })

  it.each([
    ["a zero whole", 1, 0],
    ["a fractional part", 1.5, 3],
  ])("rejects %s", (_case, part, whole) => {
    expect(() => prorateKurus(kurus(100), part, whole)).toThrow(RangeError)
  })
})

describe("weightOfMedusaAmount", () => {
  it.each([
    ["a kuruş amount", 33.33, 33_330_000],
    ["digits below a kuruş", "3.333", 3_333_000],
    ["a raw amount", { value: "89.991", precision: 20 }, 89_991_000],
    ["a negative amount weighs nothing", -1, 0],
  ])("%s", (_case, amount, expected) => {
    expect(weightOfMedusaAmount(amount)).toBe(expected)
  })

  it("rejects a missing amount", () => {
    expect(() => weightOfMedusaAmount(undefined as unknown as number)).toThrow(RangeError)
  })
})
