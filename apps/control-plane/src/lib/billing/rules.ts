import type {
  ChargeStatus,
  PlanBillingSummary,
  ReminderKind,
  SubscriptionStatus,
} from "@qticaret/types/control-plane"
import { addDays, daysBetween } from "./days"

/**
 * Billing's rules (adr/0061 §7, Ek C16), pure: every one takes "today" (an
 * Istanbul day) from its caller, so tests move the clock instead of
 * waiting.
 */

/** A period's charge opens this many days before it is due, so the first reminder can go. */
export const CHARGE_LEAD_DAYS = 14

/** Reminders go out from this Istanbul hour on (adr/0061 §7: 09:00). */
export const REMINDER_HOUR = 9

/** The default grace when a package has none set (adr/0061: 7 days). */
export const DEFAULT_GRACE_DAYS = 7

/** The grace in force: the shop's own when staff set one, else the package's. */
export const graceOf = (sub: { grace_days: number; grace_days_override: number | null }) =>
  sub.grace_days_override ?? sub.grace_days

/** The last day of grace: after it, a charge still open restricts the shop. */
export const graceEndsOn = (dueOn: string, graceDays: number): string => addDays(dueOn, graceDays)

/** Where an open charge stands on `today`. */
export type ChargeStanding = "upcoming" | "past_due" | "overdue"

export function chargeStanding(dueOn: string, graceDays: number, today: string): ChargeStanding {
  if (today < dueOn) {
    return "upcoming"
  }
  return today <= graceEndsOn(dueOn, graceDays) ? "past_due" : "overdue"
}

export interface ChargeLike {
  status: ChargeStatus
  due_on: string
  amount: number
}

/**
 * The subscription's state (adr/0061 §2): `restricted` while any open
 * charge is past its grace, `past_due` while one is past its day,
 * `trialing` before the trial's end, else `active`. `cancelled` is a
 * staff decision that comes later.
 */
export function subscriptionStatus(
  input: { trial_ends_on: string | null; graceDays: number; charges: readonly ChargeLike[] },
  today: string
): SubscriptionStatus {
  const standings = input.charges
    .filter((charge) => charge.status === "open")
    .map((charge) => chargeStanding(charge.due_on, input.graceDays, today))
  if (standings.includes("overdue")) {
    return "restricted"
  }
  if (standings.includes("past_due")) {
    return "past_due"
  }
  return input.trial_ends_on && today < input.trial_ends_on ? "trialing" : "active"
}

/** Whether any open charge is past its grace (the resume rule, Ek C16). */
export const anyOverdue = (charges: readonly ChargeLike[], graceDays: number, today: string) =>
  charges.some(
    (charge) =>
      charge.status === "open" && chargeStanding(charge.due_on, graceDays, today) === "overdue"
  )

const OFFSETS: readonly [ReminderKind, number][] = [
  ["before_14", -14],
  ["before_7", -7],
  ["before_3", -3],
  ["before_1", -1],
  ["due", 0],
  ["overdue_3", 3],
]

/**
 * The reminder an open charge is due on `today`: the latest of the
 * schedule whose day has come (14, 7, 3, 1 days before, the day, 3 days
 * after), `restricted` once its grace is over; null before the first.
 * Only the latest goes: a run missed for a few days sends one reminder,
 * not the backlog, and a charge opened late starts where the schedule
 * stands. Each kind still goes once (the reminder table).
 */
export function reminderKindFor(
  dueOn: string,
  graceDays: number,
  today: string
): ReminderKind | null {
  if (chargeStanding(dueOn, graceDays, today) === "overdue") {
    return "restricted"
  }
  const offset = daysBetween(dueOn, today)
  let kind: ReminderKind | null = null
  for (const [each, at] of OFFSETS) {
    if (offset >= at) {
      kind = each
    }
  }
  return kind
}

export interface SummaryInput {
  status: SubscriptionStatus
  graceDays: number
  /** The open charges, any order. */
  open: readonly { due_on: string; amount: number }[]
  /** When nothing is open: the next period's first day and the price it will likely have. */
  next: { due_on: string; amount: number } | null
}

/**
 * The plan document's billing summary (adr/0061 §3.2, Ek C16): the
 * subscription's state, the oldest open charge's day and amount (or the
 * next renewal's when nothing is open) and, while it is late, the last day
 * of its grace. No date is read here: the summary changes only when the
 * stored state does, so the document is issued again only then.
 */
export function billingSummary(
  input: SummaryInput
): Omit<PlanBillingSummary, "package_name" | "payment_instruction"> {
  const [first] = [...input.open].sort((a, b) => a.due_on.localeCompare(b.due_on))
  const late = input.status === "past_due" || input.status === "restricted"
  const shown = first ?? input.next
  return {
    status: input.status,
    due_on: shown?.due_on ?? null,
    grace_ends_on: first && late ? graceEndsOn(first.due_on, input.graceDays) : null,
    amount: shown?.amount ?? null,
    currency: "TRY",
  }
}
