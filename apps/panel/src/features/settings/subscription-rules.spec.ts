import { describe, expect, it } from "vitest"
import type { BillingSummary } from "@/features/settings/api/plan"
import { LIMITS } from "@/features/settings/plan.fixtures"
import { limitGroups, periodLabel, planState, storageText } from "./subscription-rules"

const billing = (changes: Partial<BillingSummary> = {}): BillingSummary => ({
  status: "active",
  due_on: "2026-12-01",
  grace_ends_on: null,
  amount: 149_900,
  currency: "TRY",
  ...changes,
})

describe("planState", () => {
  const today = "2026-11-20"

  it("reads the payment's state for an active shop", () => {
    expect(planState({ status: "active", billing: billing() }, today)).toBe("active")
    expect(planState({ status: "active", billing: null }, today)).toBe("active")
    expect(planState({ status: "active", billing: billing({ status: "trialing" }) }, today)).toBe(
      "trialing"
    )
    expect(planState({ status: "active", billing: billing({ status: "past_due" }) }, today)).toBe(
      "past_due"
    )
    expect(planState({ status: "active", billing: billing({ status: "cancelled" }) }, today)).toBe(
      "cancelled"
    )
  })

  it("says a payment is near in the strip's last days only", () => {
    expect(planState({ status: "active", billing: billing({ due_on: "2026-11-23" }) }, today)).toBe(
      "due_soon"
    )
    expect(planState({ status: "active", billing: billing({ due_on: "2026-11-24" }) }, today)).toBe(
      "active"
    )
  })

  it("leads with the shop's own state where it says more", () => {
    const late = billing({ status: "past_due" })
    expect(planState({ status: "restricted", billing: late }, today)).toBe("restricted")
    expect(planState({ status: "suspended", billing: late }, today)).toBe("suspended")
    expect(planState({ status: "provisioning", billing: null }, today)).toBe("provisioning")
  })
})

describe("page wording", () => {
  it("writes a month as words, and leaves an unknown period as it is", () => {
    expect(periodLabel("2026-11")).toBe("Kasım 2026")
    expect(periodLabel("2026-13")).toBe("2026-13")
  })

  it("writes storage in MB below a gigabyte and in GB from one", () => {
    expect(storageText(380)).toBe("380 MB")
    expect(storageText(1024)).toBe("1 GB")
    expect(storageText(1700)).toBe("1,7 GB")
    expect(storageText(10_240)).toBe("10 GB")
  })

  it("groups the shown limits into totals and monthly", () => {
    const { totals, monthly } = limitGroups(LIMITS)
    expect(totals.map((limit) => limit.key)).toEqual(["products", "staff", "storage_mb"])
    expect(monthly.map((limit) => limit.key)).toEqual(["orders_per_month", "llm_credits_per_month"])
  })
})
