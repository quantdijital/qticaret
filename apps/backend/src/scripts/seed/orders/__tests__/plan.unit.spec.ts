import { planDemoOrders } from "../plan"

const NOW = new Date("2026-10-26T11:30:00Z")
const input = { now: NOW, days: 90, weights: [3, 1, 1], places: 4 }

describe("planDemoOrders", () => {
  it("is the same on every run, in date order, inside the window and before now", () => {
    const first = planDemoOrders(input)
    const second = planDemoOrders(input)
    const earliest = NOW.getTime() - 90 * 86_400_000

    expect(second).toEqual(first)
    expect(first.length).toBeGreaterThan(100)
    for (const [index, order] of first.entries()) {
      expect(order.at.getTime()).toBeLessThan(NOW.getTime())
      expect(order.at.getTime()).toBeGreaterThan(earliest)
      expect(order.at.getTime()).toBeGreaterThanOrEqual(first[index - 1]?.at.getTime() ?? 0)
    }
  })

  it("takes older orders further along and keeps today's to ship or in transit", () => {
    const plan = planDemoOrders(input)
    const old = plan.filter((order) => NOW.getTime() - order.at.getTime() > 10 * 86_400_000)
    const today = plan.filter((order) => NOW.getTime() - order.at.getTime() < 8 * 3_600_000)

    expect(old.filter((order) => order.stage === "delivered").length / old.length).toBeGreaterThan(
      0.7
    )
    expect(today.every((order) => order.stage === "to_ship" || order.stage === "shipped")).toBe(
      true
    )
  })

  it("orders each variant at most once per order, and favours the popular ones", () => {
    const plan = planDemoOrders(input)
    const counts = [0, 0, 0]
    for (const order of plan) {
      const variants = order.lines.map((line) => line.variant)
      expect(new Set(variants).size).toBe(variants.length)
      for (const variant of variants) {
        counts[variant] = (counts[variant] ?? 0) + 1
      }
    }
    expect(counts[0]).toBeGreaterThan(counts[1] ?? 0)
  })
})
