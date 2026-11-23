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

/** Whole days from `today` to `day` (both Istanbul `YYYY-MM-DD`); negative once it passed. */
export const daysUntil = (day: string, today: string): number =>
  Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)

/**
 * The day the package card counts to: a trial's end, the next payment,
 * the grace's last day while a payment is late, or how long it is overdue
 * once the grace is gone. Null with nothing open.
 */
export interface Countdown {
  kind: "trial" | "due" | "grace" | "overdue"
  /** Days left, or (overdue) days past the due day; never negative. */
  days: number
}

export function countdownOf(
  state: PlanState,
  billing: BillingSummary | null,
  today: string
): Countdown | null {
  if (!billing?.due_on) {
    return null
  }
  const due = daysUntil(billing.due_on, today)
  if (isLate(state) && billing.grace_ends_on) {
    const grace = daysUntil(billing.grace_ends_on, today)
    if (grace >= 0) {
      return { kind: "grace", days: grace }
    }
  }
  if (due < 0 || isLate(state)) {
    return { kind: "overdue", days: Math.max(-due, 0) }
  }
  return { kind: state === "trialing" ? "trial" : "due", days: due }
}

/**
 * The ring's scale: a month of days. The plan document carries neither a
 * trial's length nor the billing interval, so the ring counts down within
 * a month instead of showing a share of a known whole; a late payment's
 * ring is full.
 */
export const RING_DAYS = 30

export const ringShare = (countdown: Countdown): number =>
  countdown.kind === "overdue" ? 1 : Math.min(countdown.days, RING_DAYS) / RING_DAYS

/**
 * Where a usage tile sits on a 6-column grid (tablet up to `xl`): a
 * group's tiles share its rows evenly so no row ends with a hole; 1 fills
 * the row, 2 and 4 take halves, 3 and more thirds.
 */
export const tileSpan = (count: number): 2 | 3 | 6 =>
  count <= 1 ? 6 : count === 2 || count === 4 ? 3 : 2
