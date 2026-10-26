import { describe, expect, it } from "vitest"
import {
  applicationMethod,
  buyGetMethod,
  buyGetOf,
  offerKind,
  ownsCampaign,
  scheduleOf,
} from "./offer"

describe("offers", () => {
  it("reads free shipping, amounts and percentages back from the method", () => {
    expect(offerKind(applicationMethod("free_shipping", 0, "try"))).toBe("free_shipping")
    expect(offerKind(applicationMethod("fixed", 50, "try"))).toBe("fixed")
    expect(offerKind(applicationMethod("percentage", 10, "try"))).toBe("percentage")
    expect(offerKind({ type: "percentage", target_type: "shipping_methods", value: 50 })).toBe(
      "percentage"
    )
  })

  it("gives an amount off its currency, a percentage none", () => {
    expect(applicationMethod("fixed", 50, "try")).toMatchObject({
      currency_code: "try",
      allocation: "across",
    })
    expect(applicationMethod("percentage", 10, "try")).not.toHaveProperty("currency_code")
  })

  it("tells running, scheduled and ended apart for an active promotion", () => {
    const now = new Date("2026-10-25T12:00:00Z")
    expect(scheduleOf("active", null, now)).toBe("active")
    expect(scheduleOf("active", { starts_at: "2026-11-01T00:00:00Z" }, now)).toBe("scheduled")
    expect(scheduleOf("active", { ends_at: "2026-10-01T00:00:00Z" }, now)).toBe("ended")
    expect(scheduleOf("draft", null, now)).toBe("draft")
  })

  it("owns a campaign only as its sole member; unknown members count as shared", () => {
    expect(ownsCampaign("p1", [{ id: "p1" }])).toBe(true)
    expect(ownsCampaign("p1", [{ id: "p1" }, { id: "p2" }])).toBe(false)
    expect(ownsCampaign("p1", undefined)).toBe(false)
  })
})

describe("buy X, pay Y", () => {
  const scope = { scope: "products" as const, ids: ["prod_1"] }

  it("is Medusa's buy-get: pay for Y, X − Y more free, as often as the basket allows", () => {
    expect(buyGetMethod(3, 2, scope)).toEqual({
      type: "percentage",
      target_type: "items",
      allocation: "each",
      value: 100,
      max_quantity: 1000,
      apply_to_quantity: 1,
      buy_rules_min_quantity: 2,
      buy_rules: [{ attribute: "items.product.id", operator: "in", values: ["prod_1"] }],
      target_rules: [{ attribute: "items.product.id", operator: "in", values: ["prod_1"] }],
    })
  })

  it("reads back from the method, and knows the kind by it", () => {
    const method = buyGetMethod(5, 3, scope)
    expect(buyGetOf(method)).toEqual({ buy: 5, pay: 3 })
    expect(offerKind(method)).toBe("buyget")
    expect(buyGetOf({ type: "percentage", value: 10 })).toBeNull()
  })
})
