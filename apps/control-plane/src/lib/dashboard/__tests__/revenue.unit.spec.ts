import { monthlyOf, recurringRevenue, renewalWindow } from "../revenue"

describe("the dashboard's money rules (Ek C18)", () => {
  it("counts a yearly price as a twelfth, rounded half up once over the sum", () => {
    expect(monthlyOf([{ status: "active", period: "monthly", count: 2, total: 298_000 }])).toBe(
      298_000
    )
    // 1.490,00 TL a year: 12.416,66… kuruş a month → 12.417
    expect(monthlyOf([{ status: "active", period: "yearly", count: 1, total: 149_000 }])).toBe(
      12_417
    )
    // Exactly half a kuruş rounds up: 6 kuruş a year is 0,5 a month
    expect(monthlyOf([{ status: "active", period: "yearly", count: 1, total: 6 }])).toBe(1)
    // Summed before dividing: three of 10 kuruş a year are 2,5 → 3, not 3 × 1
    expect(monthlyOf([{ status: "active", period: "yearly", count: 3, total: 30 }])).toBe(3)
    expect(monthlyOf([])).toBe(0)
  })

  it("counts paying subscriptions and reports trials apart", () => {
    const revenue = recurringRevenue([
      { status: "active", period: "monthly", count: 2, total: 200_000 },
      { status: "past_due", period: "monthly", count: 1, total: 100_000 },
      { status: "restricted", period: "yearly", count: 1, total: 1_200_000 },
      { status: "trialing", period: "monthly", count: 3, total: 147_000 },
      { status: "trialing", period: "yearly", count: 1, total: 120_000 },
    ])

    expect(revenue).toEqual({
      mrr: 400_000,
      paying_count: 4,
      trial: { count: 4, mrr: 157_000 },
      currency_code: "TRY",
    })
  })

  it("looks thirty Istanbul days ahead, today included", () => {
    expect(renewalWindow("2026-11-12")).toEqual({ from: "2026-11-12", to: "2026-12-11" })
    expect(renewalWindow("2027-02-15")).toEqual({ from: "2027-02-15", to: "2027-03-16" })
  })
})
