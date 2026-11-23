import { describe, expect, it } from "vitest"
import type { BillingSummary, PaymentRecord } from "@/features/settings/api/plan"
import {
  paymentDayOf,
  paymentPeriodLabel,
  paymentStateOf,
  periodDays,
  ringShare,
  trialProgress,
} from "./subscription-rules"

const billing = (changes: Partial<BillingSummary> = {}): BillingSummary => ({
  status: "active",
  due_on: "2026-12-01",
  grace_ends_on: null,
  amount: 149_900,
  currency: "TRY",
  ...changes,
})

const payment = (changes: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: "chg_01",
  period: "monthly",
  period_start: "2026-11-01",
  period_end: "2026-12-01",
  due_on: "2026-11-01",
  amount: 149_000,
  currency: "TRY",
  status: "open",
  paid_on: null,
  invoice_number: null,
  invoice_url: null,
  ...changes,
})

describe("the subscription's terms (adr/0061 Ek C20)", () => {
  const trial = billing({
    status: "trialing",
    trial_started_on: "2026-11-17",
    trial_ends_on: "2026-12-01",
  })

  it("counts a trial's days used of its whole, held inside it", () => {
    expect(trialProgress(trial, "2026-11-26")).toEqual({ used: 9, total: 14 })
    expect(trialProgress(trial, "2026-11-10")).toEqual({ used: 0, total: 14 })
    expect(trialProgress(trial, "2026-12-20")).toEqual({ used: 14, total: 14 })
    // An older document, or a trial without both days: no whole to show
    expect(trialProgress(billing(), "2026-11-26")).toBeNull()
    expect(trialProgress(billing({ trial_started_on: "2026-11-17" }), "2026-11-26")).toBeNull()
  })

  it("fills a trial's ring by the days used, a payment's by its period", () => {
    expect(ringShare({ kind: "trial", days: 5 }, { trial: { used: 7, total: 14 } })).toBe(0.5)
    expect(ringShare({ kind: "due", days: 73 }, { period: "yearly" })).toBe(0.2)
    expect(ringShare({ kind: "due", days: 15 }, { period: "monthly" })).toBe(0.5)
    expect(periodDays(null)).toBe(30)
  })
})

describe("the payments (adr/0061 Ek C20)", () => {
  it("names a payment's state: an open one past its day is late", () => {
    expect(paymentStateOf(payment(), "2026-11-01")).toBe("open")
    expect(paymentStateOf(payment(), "2026-11-02")).toBe("late")
    expect(paymentStateOf(payment({ status: "paid", paid_on: "2026-11-03" }), "2026-12-30")).toBe(
      "paid"
    )
    expect(paymentStateOf(payment({ status: "waived" }), "2026-12-30")).toBe("waived")
  })

  it("shows the paid day when paid, else the due day; a period in words", () => {
    expect(paymentDayOf(payment({ status: "paid", paid_on: "2026-11-03" }))).toBe("2026-11-03")
    expect(paymentDayOf(payment())).toBe("2026-11-01")
    expect(paymentPeriodLabel(payment())).toBe("Kasım 2026")
    expect(paymentPeriodLabel(payment({ period: "yearly", period_end: "2027-11-01" }))).toBe(
      "Kasım 2026 – Ekim 2027"
    )
  })
})
