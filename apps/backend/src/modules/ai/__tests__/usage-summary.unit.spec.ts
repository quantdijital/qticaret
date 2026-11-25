import { summaryOf, turkeyDayOf, turkeyMonthBounds } from "../usage-summary"

/** adr/0071 §11: the usage summary's days, months and folding. */
describe("usage summary", () => {
  it("takes Turkey's day and month bounds", () => {
    expect(turkeyDayOf(new Date("2026-04-30T20:59:00Z"))).toBe("2026-04-30")
    expect(turkeyDayOf(new Date("2026-04-30T21:00:00Z"))).toBe("2026-05-01")
    expect(turkeyMonthBounds("2026-12")).toEqual({
      from: new Date("2026-11-30T21:00:00Z"),
      to: new Date("2026-12-31T21:00:00Z"),
    })
    expect(() => turkeyMonthBounds("2026-13")).toThrow()
  })

  it("folds rows by service and task, the busiest first, cost by currency", () => {
    const summary = summaryOf("2026-11", [
      { service: "gemini", task: "t1", status: "succeeded", currency: "USD", count: 2, cost: "40" },
      { service: "gemini", task: "t1", status: "cancelled", currency: null, count: "1", cost: 0 },
      { service: "deepseek", task: "t2", status: "refused", currency: "USD", count: 4, cost: 8 },
    ])

    expect(summary.services).toEqual([
      {
        id: "deepseek",
        count: 4,
        succeeded: 0,
        refused: 4,
        failed: 0,
        estimated_cost_micros: { USD: 8 },
      },
      {
        id: "gemini",
        count: 3,
        succeeded: 2,
        refused: 0,
        failed: 1,
        estimated_cost_micros: { USD: 40 },
      },
    ])
    expect(summary.tasks.map((line) => line.id)).toEqual(["t2", "t1"])
  })

  it("adds up the month on the platform's credits apart from the shop's own key", () => {
    const row = { status: "succeeded", currency: null, cost: 0 }
    const summary = summaryOf("2026-11", [
      {
        ...row,
        service: "platform",
        task: "seo_title",
        count: 3,
        funding: "platform_credit",
        credits: "3",
      },
      {
        ...row,
        service: "platform",
        task: "image_scene",
        count: 1,
        funding: "platform_credit",
        credits: 40,
      },
      {
        ...row,
        service: "platform",
        task: "seo_title",
        status: "failed",
        count: 1,
        funding: "platform_credit",
        credits: null,
      },
      { ...row, service: "deepseek", task: "seo_title", count: 5, funding: "own_key", credits: 0 },
      // A row read without the funding (before adr/0085) is the shop's own
      { ...row, service: "gemini", task: "seo_title", count: 2 },
    ])

    expect(summary.platform_credits).toEqual({
      calls: 5,
      credits: 43,
      tasks: [
        { id: "image_scene", calls: 1, credits: 40 },
        { id: "seo_title", calls: 4, credits: 3 },
      ],
    })
    // The lines count every call, whichever paid
    expect(summary.tasks.find((line) => line.id === "seo_title")?.count).toBe(11)
    expect(summaryOf("2026-11", []).platform_credits).toEqual({ calls: 0, credits: 0, tasks: [] })
  })
})
