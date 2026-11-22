import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ListingQuery } from "../../lib/seo/facets"
import { DEPARTURE_SORT, todayIn } from "../../lib/seo/facets-dated"
import type { ListingDates } from "../../lib/seo/facets-dated"
import type { DepartureDates } from "../../modules/booking/service"
import { bookingService } from "../booking/cart/target"

/**
 * A listing's dates and party (adr/0077 §2–§3): the dated products with a
 * departure inside the dates and room for the party narrow the listing,
 * nearest departure first; `sirala=kalkis` without dates orders by the
 * next departure within a year, the products without one after. Only a
 * product still sold by departure (`booking_mode`) counts: settings kept
 * from an earlier mode are not a departure. The query holds dates only
 * while the shop sells dated products (facets.ts).
 */

/** Products a date search narrows to at most, the nearest first (adr/0077 Riskler). */
export const MAX_DATED_PRODUCTS = 1000

/** How far ahead `kalkis` looks without dates. */
const AHEAD_DAYS = 365

export interface DatedListing {
  /** The products the listing is narrowed to; null: not narrowed. */
  scope_ids: string[] | null
  /** The order of `ids_order`, nearest departure first; null: no such order. */
  order_ids: string[] | null
}

const NONE: DatedListing = { scope_ids: null, order_ids: null }

const dayPlus = (day: string, days: number): string => {
  const time = Date.parse(`${day}T00:00:00Z`) + days * 24 * 60 * 60 * 1000
  return new Date(time).toISOString().slice(0, 10)
}

/** The listing's dates as the booking module reads them. */
export function departureDatesOf(dates: ListingDates): DepartureDates {
  return dates.kind === "range"
    ? { ranges: [{ from: dates.from, to: dates.to }] }
    : { months: dates.months }
}

/** Which of these products are sold by departure now. */
async function departureProducts(container: MedusaContainer, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "product_extension.booking_mode"],
    filters: { id: ids },
  })
  return new Set(
    (data as { id: string; product_extension?: { booking_mode?: string | null } | null }[])
      .filter((product) => product.product_extension?.booking_mode === "departure")
      .map((product) => product.id)
  )
}

/** What the query's dates, party and `kalkis` make of the listing. */
export async function datedListing(
  container: MedusaContainer,
  query: ListingQuery,
  now: Date = new Date()
): Promise<DatedListing> {
  const ordered = query.sort === DEPARTURE_SORT
  if (!query.dates && !ordered) {
    return NONE
  }
  const today = todayIn(now)
  const dates: DepartureDates = query.dates
    ? departureDatesOf(query.dates)
    : { ranges: [{ from: today, to: dayPlus(today, AHEAD_DAYS) }] }
  const matches = await bookingService(container).departureMatches({
    dates,
    pax: query.pax ?? 1,
    now,
  })
  const first = matches.slice(0, MAX_DATED_PRODUCTS).map((match) => match.product_id)
  const sold = await departureProducts(container, first)
  const ids = first.filter((id) => sold.has(id))
  return { scope_ids: query.dates ? ids : null, order_ids: ids }
}
