import type { BillingSummary, LimitStanding, PaymentRecord } from "@/features/settings/api/plan"
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

/** A billing period's length in days, for the ring: a month or a year. */
export const periodDays = (period: BillingSummary["period"]): number =>
  period === "yearly" ? 365 : 30

/**
 * The ring's scale without a known whole: a month of days. A trial with
 * both its days known fills by the days used (`trialProgress`); a
 * payment's ring counts down within the period (a month, or a year); a
 * late payment's ring is full.
 */
export const RING_DAYS = 30

/** A trial's days used of its whole ("9 / 14"), when the document gives both its days. */
export interface TrialProgress {
  used: number
  total: number
}

export function trialProgress(billing: BillingSummary | null, today: string): TrialProgress | null {
  const start = billing?.trial_started_on
  const end = billing?.trial_ends_on
  if (!start || !end) {
    return null
  }
  const total = daysUntil(end, start)
  if (total <= 0) {
    return null
  }
  return { used: Math.min(Math.max(daysUntil(today, start), 0), total), total }
}

export function ringShare(
  countdown: Countdown,
  options: { trial?: TrialProgress | null; period?: BillingSummary["period"] } = {}
): number {
  if (countdown.kind === "overdue") {
    return 1
  }
  if (countdown.kind === "trial" && options.trial) {
    return options.trial.used / options.trial.total
  }
  const whole = countdown.kind === "due" ? periodDays(options.period) : RING_DAYS
  return Math.min(countdown.days, whole) / whole
}

/**
 * Where a usage tile sits on a 6-column grid (tablet up to `xl`): a
 * group's tiles share its rows evenly so no row ends with a hole; 1 fills
 * the row, 2 and 4 take halves, 3 and more thirds.
 */
export const tileSpan = (count: number): 2 | 3 | 6 =>
  count <= 1 ? 6 : count === 2 || count === 4 ? 3 : 2

/** A payment's status as its row says it: an open one past its day is late. */
export type PaymentState = "paid" | "waived" | "open" | "late"

export const paymentStateOf = (record: PaymentRecord, today: string): PaymentState =>
  record.status === "open" ? (record.due_on < today ? "late" : "open") : record.status

/** The day a payment's row shows: when it was paid, else when it is (was) due. */
export const paymentDayOf = (record: PaymentRecord): string =>
  record.status === "paid" && record.paid_on ? record.paid_on : record.due_on

/**
 * A payment's period in words: its month for a monthly one ("Kasım 2026"),
 * first and last month for a yearly one ("Kasım 2026 – Ekim 2027").
 */
export function paymentPeriodLabel(record: PaymentRecord): string {
  const first = periodLabel(record.period_start.slice(0, 7))
  if (record.period !== "yearly") {
    return first
  }
  const lastDay = new Date(Date.parse(`${record.period_end}T00:00:00Z`) - 86_400_000)
  const last = periodLabel(lastDay.toISOString().slice(0, 7))
  return `${first} – ${last}`
}
