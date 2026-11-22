import { PACKAGE_TRAVEL_FREE_DAYS, effectiveTiers } from "./cancellation"
import type { CancellationTiersType } from "./settings"

/**
 * What a booking's messages and voucher say of a departure (adr/0076 §8,
 * Ek D7b), worked out without a database: its time in the product's zone,
 * its cancellation terms as sold, and whether its reminder is due.
 */

/** Attribute keys read as a departure's meeting point (a sector pack's "Kalkış yeri"). */
export const MEETING_POINT_KEYS: readonly string[] = ["kalkis_yeri", "bulusma_yeri"]

/** A departure's date and time as a Turkish reader reads it, in the product's zone. */
export function departureTime(startsAt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(startsAt)
}

/** One line of the terms: from this many days before the departure, this share is kept. */
export interface TermLine {
  days_before: number
  fee_percent: number
}

/**
 * The terms as the shopper may rely on them, farthest first: the copy
 * made when the booking was confirmed, with the package travel floor
 * (30 days or more keep nothing) shown even where no tier says so.
 * Empty: no cancel from the shopper's account.
 */
export function termLines(
  tiers: CancellationTiersType | null | undefined,
  packageTravel: boolean
): TermLine[] {
  const lines = effectiveTiers(tiers, packageTravel).map((tier) => ({
    days_before: tier.days_before,
    fee_percent: tier.fee_percent,
  }))
  if (packageTravel && !lines.some((line) => line.days_before >= PACKAGE_TRAVEL_FREE_DAYS)) {
    lines.unshift({ days_before: PACKAGE_TRAVEL_FREE_DAYS, fee_percent: 0 })
  }
  return lines
}

/** What decides whether a departure's reminder goes now (as `DUE_REMINDERS` reads it). */
export interface ReminderFacts {
  starts_at: Date
  /** When its booking was confirmed. */
  booked_at: Date
  reminder_days: number
  /** The departure, its booking or the whole departure cancelled. */
  cancelled: boolean
  reminded: boolean
}

const DAY = 24 * 60 * 60 * 1000

/**
 * Due: live, not reminded, starting after `now` and within its days, and
 * booked before that window opened (one booked inside it has just had its
 * confirmation). 0 days sends none.
 */
export function reminderDue(facts: ReminderFacts, now: Date): boolean {
  if (facts.cancelled || facts.reminded || facts.reminder_days <= 0) {
    return false
  }
  const opens = facts.starts_at.getTime() - facts.reminder_days * DAY
  return (
    facts.starts_at.getTime() > now.getTime() &&
    now.getTime() >= opens &&
    facts.booked_at.getTime() < opens
  )
}
