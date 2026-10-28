import { describe, expect, it } from "vitest"
import { draftOf, rulesOf } from "./segment-form"

describe("segment form", () => {
  it("reads lira as kuruş, counts as numbers, and three-way choices as rules or none", () => {
    expect(
      rulesOf({
        ...draftOf(),
        name: " Sadık müşteriler ",
        minSpent: "1.250,50",
        minOrders: "3",
        registered: "yes",
        consent: "any",
      })
    ).toEqual({
      name: "Sadık müşteriler",
      rules: { min_total_spent: 125050, min_orders: 3, registered: true },
    })
  })

  it("names the first wrong field, and asks for at least one rule", () => {
    expect(rulesOf({ ...draftOf(), name: "" })).toMatchObject({ field: "name" })
    expect(rulesOf({ ...draftOf(), name: "A", minSpent: "abc" })).toMatchObject({
      field: "minSpent",
    })
    expect(rulesOf({ ...draftOf(), name: "A", withinDays: "1,5" })).toMatchObject({
      field: "withinDays",
    })
    expect(rulesOf({ ...draftOf(), name: "A" })).toMatchObject({ field: "rules" })
  })

  it("shows a saved segment's rules back in the form", () => {
    const draft = draftOf({
      id: "cseg_1",
      name: "Geri kazan",
      rules: { not_ordered_for_days: 90, email_consent: true, min_total_spent: 50000 },
      customer_group_id: "cusgroup_1",
      member_count: 4,
      refreshed_at: null,
    })
    expect(draft).toMatchObject({ lapsedDays: "90", consent: "yes", minSpent: "500" })
    expect(rulesOf(draft)).toEqual({
      name: "Geri kazan",
      rules: { not_ordered_for_days: 90, email_consent: true, min_total_spent: 50000 },
    })
  })
})
