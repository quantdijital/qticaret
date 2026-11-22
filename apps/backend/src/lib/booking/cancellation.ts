import { CancellationTiers } from "./settings"
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
  // The floor is the days actually left (review D1), handled above: a tier of 30 days or
  // more reached here (every tier that far out, the day closer) keeps its own share
  return { fee_percent: tier.fee_percent, days_before: tier.days_before }
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

/** The terms a departure's cancel is reckoned by: its tiers and the zone its days are counted in. */
export interface CancellationTerms {
  timezone: string
  tiers: CancellationTiersType
}

const DEFAULT_ZONE = "Europe/Istanbul"

function validZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || zone === "") {
    return false
  }
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/**
 * The terms as sold (review O5): the copy the booking's confirmation
 * wrote (`{ timezone, tiers }`) when it reads as such; a booking
 * confirmed before the copy existed (null), or a copy that does not
 * parse, is reckoned by the product's settings now (`live`).
 */
export function cancellationTermsOf(
  copy: unknown,
  live: { timezone?: string | null; tiers?: unknown }
): CancellationTerms {
  if (copy && typeof copy === "object") {
    const { timezone, tiers } = copy as { timezone?: unknown; tiers?: unknown }
    const parsed = CancellationTiers.safeParse(tiers ?? [])
    if (validZone(timezone) && parsed.success) {
      return { timezone, tiers: parsed.data }
    }
  }
  const parsed = CancellationTiers.safeParse(live.tiers ?? [])
  return {
    timezone: validZone(live.timezone) ? live.timezone : DEFAULT_ZONE,
    tiers: parsed.success ? parsed.data : [],
  }
}
