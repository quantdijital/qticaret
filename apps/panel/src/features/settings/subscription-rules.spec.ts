import { describe, expect, it } from "vitest"
import type { BillingSummary } from "@/features/settings/api/plan"
import { LIMITS } from "@/features/settings/plan.fixtures"
import {
  countdownOf,
  daysUntil,
  limitGroups,
  periodLabel,
  planState,
  ringShare,
  storageText,
  tileSpan,
} from "./subscription-rules"

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

describe("countdownOf", () => {
  const today = "2026-11-20"

  it("counts to the next payment, or a trial's end", () => {
    expect(countdownOf("active", billing(), today)).toEqual({ kind: "due", days: 11 })
    expect(countdownOf("due_soon", billing({ due_on: "2026-11-20" }), today)).toEqual({
      kind: "due",
      days: 0,
    })
    expect(countdownOf("trialing", billing({ status: "trialing" }), today)).toEqual({
      kind: "trial",
      days: 11,
    })
  })

  it("counts a late payment's grace, then the days overdue once it is gone", () => {
    const late = billing({ status: "past_due", due_on: "2026-11-10", grace_ends_on: "2026-11-17" })
    expect(countdownOf("past_due", { ...late, grace_ends_on: "2026-11-24" }, today)).toEqual({
      kind: "grace",
      days: 4,
    })
    expect(countdownOf("past_due", { ...late, grace_ends_on: "2026-11-20" }, today)).toEqual({
      kind: "grace",
      days: 0,
    })
    expect(countdownOf("restricted", late, today)).toEqual({ kind: "overdue", days: 10 })
    expect(countdownOf("past_due", { ...late, grace_ends_on: null }, today)).toEqual({
      kind: "overdue",
      days: 10,
    })
  })

  it("has nothing to count without an open payment", () => {
    expect(countdownOf("active", null, today)).toBeNull()
    expect(countdownOf("active", billing({ due_on: null }), today)).toBeNull()
  })

  it("fills the ring within a month, a late payment's fully", () => {
    expect(ringShare({ kind: "due", days: 15 })).toBe(0.5)
    expect(ringShare({ kind: "trial", days: 45 })).toBe(1)
    expect(ringShare({ kind: "grace", days: 0 })).toBe(0)
    expect(ringShare({ kind: "overdue", days: 3 })).toBe(1)
    expect(daysUntil("2026-12-01", "2026-11-20")).toBe(11)
    expect(daysUntil("2026-11-10", "2026-11-20")).toBe(-10)
  })
})

describe("tileSpan", () => {
  it("shares a group's rows evenly on the 6-column grid", () => {
    expect([1, 2, 3, 4, 5].map(tileSpan)).toEqual([6, 3, 2, 3, 2])
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
