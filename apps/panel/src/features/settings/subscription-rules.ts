import type { BillingSummary, LimitStanding } from "@/features/settings/api/plan"
import { paymentStrip, shownLimits } from "@/features/settings/plan-rules"

/**
 * The one status Settings > Abonelik leads with: the shop's own state
 * where it says more (restricted, suspended, closing), else its payment's.
 * `due_soon` is an active subscription in its payment strip's last days.
 */
export type PlanState =
  | "provisioning"
  | "trialing"
  | "active"
  | "due_soon"
  | "past_due"
  | "restricted"
  | "suspended"
  | "cancelled"
  | "closing"
  | "closed"

const SHOP_STATES = new Set<string>([
  "provisioning",
  "restricted",
  "suspended",
  "closing",
  "closed",
])

export function planState(
  plan: { status: string; billing: BillingSummary | null },
  today: string
): PlanState {
  if (SHOP_STATES.has(plan.status)) {
    return plan.status as PlanState
  }
  const billing = plan.billing
  if (!billing || billing.status === "active") {
    return billing && paymentStrip(billing, today) === "soon" ? "due_soon" : "active"
  }
  return billing.status
}

/** Whether a payment is late: its due day passed, the grace day (if any) is the one to watch. */
export const isLate = (state: PlanState): boolean =>
  state === "past_due" || state === "restricted" || state === "suspended"

/** A plan's month (`2026-11`) as the page writes it ("Kasım 2026"); the raw text if it is not one. */
export function periodLabel(period: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    return period
  }
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${period}-01T00:00:00Z`))
}

/** Megabytes as a person reads them: MB below a gigabyte, GB (one decimal at most) from one. */
export function storageText(mb: number): string {
  if (mb < 1024) {
    return `${new Intl.NumberFormat("tr-TR").format(mb)} MB`
  }
  const gb = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(mb / 1024)
  return `${gb} GB`
}

/** The shown limits in two groups: the shop's totals and the ones counted per month. */
export function limitGroups(limits: readonly LimitStanding[]): {
  totals: LimitStanding[]
  monthly: LimitStanding[]
} {
  const shown = shownLimits(limits)
  return {
    totals: shown.filter((limit) => !limit.monthly),
    monthly: shown.filter((limit) => limit.monthly),
  }
}
