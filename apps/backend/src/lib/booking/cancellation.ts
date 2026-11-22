import type { CancellationTiersType } from "./settings"

/**
 * A dated booking's cancellation (adr/0076 §8, Ek D7a). The shop's tiers
 * say "N days or more before the service day, X% is kept"; the server
 * picks the tier from the days left and works the refund out from what
 * the lines were paid, never from a request. Pure, so tested on its own.
 */

/** A package travel seller (the returns settings' `package_travel`) keeps nothing this early. */
export const PACKAGE_TRAVEL_FREE_DAYS = 30
/** What such a seller tells the shopper: the refund is made within this many days. */
export const PACKAGE_TRAVEL_REFUND_DAYS = 14

const DAY = 24 * 60 * 60 * 1000

/** The calendar day (`YYYY-MM-DD`) a moment falls on in the zone. */
function dayIn(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at)
  const part = (type: string) => parts.find((each) => each.type === type)?.value ?? "00"
  return `${part("year")}-${part("month")}-${part("day")}`
}

/**
 * Calendar days from today to the service day, both in the product's zone
 * (a departure at 07:00 tomorrow is one day away whatever the hour now);
 * negative once the day is past, 0 on the day itself.
 */
export function daysBefore(startsAt: Date, now: Date, timeZone = "Europe/Istanbul"): number {
  const start = Date.parse(`${dayIn(startsAt, timeZone)}T00:00:00Z`)
  const today = Date.parse(`${dayIn(now, timeZone)}T00:00:00Z`)
  return Math.round((start - today) / DAY)
}

export interface FeeRule {
  /** The percent kept, 0–100. */
  fee_percent: number
  /** The tier it came from (its days); null for the package travel floor. */
  days_before: number | null
}

/**
 * The share kept when the booking is cancelled `days` days before its
 * service day: the tier with the most days not above `days`; below every
 * tier, the one with the fewest days (the shop's closest rule goes on to
 * the day and after). A package travel seller keeps nothing 30 days or
 * more ahead, whatever its tiers say. Null when the shop set no tier and
 * no floor applies: no self-service cancel, the shop decides.
 */
export function feeRuleFor(
  tiers: CancellationTiersType | null | undefined,
  days: number,
  options: { packageTravel: boolean }
): FeeRule | null {
  if (options.packageTravel && days >= PACKAGE_TRAVEL_FREE_DAYS) {
    return { fee_percent: 0, days_before: null }
  }
  const sorted = [...(tiers ?? [])].sort((a, b) => b.days_before - a.days_before)
  const tier = sorted.find((each) => days >= each.days_before) ?? sorted[sorted.length - 1]
  if (!tier) {
    return null
  }
  const free = options.packageTravel && tier.days_before >= PACKAGE_TRAVEL_FREE_DAYS
  return { fee_percent: free ? 0 : tier.fee_percent, days_before: tier.days_before }
}

/**
 * The tiers as the shop sees them under the floor: a package travel
 * seller's tiers of 30 days or more keep nothing (the panel says so).
 */
export function effectiveTiers(
  tiers: CancellationTiersType | null | undefined,
  packageTravel: boolean
): CancellationTiersType {
  return [...(tiers ?? [])]
    .sort((a, b) => b.days_before - a.days_before)
    .map((tier) =>
      packageTravel && tier.days_before >= PACKAGE_TRAVEL_FREE_DAYS
        ? { ...tier, fee_percent: 0 }
        : tier
    )
}
