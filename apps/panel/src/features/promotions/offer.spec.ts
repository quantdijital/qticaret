import { describe, expect, it } from "vitest"
import { applicationMethod, offerKind, ownsCampaign, scheduleOf } from "./offer"

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
