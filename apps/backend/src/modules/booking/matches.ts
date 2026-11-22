import { asInt, marks, rows } from "./sql"
import type { Executor, Row } from "./sql"
import { availabilityOf } from "./availability"
import type { SlotAvailability } from "./availability"

/**
 * Dated products found by their departures (adr/0077 §3): a departure
 * matches when it is open, its sales have not closed (`cutoff_hours`), it
 * starts inside the dates asked, and its free places (capacity − sold −
 * live holds) cover the party. Dates are the product's own: a day or a
 * month starts and ends in its `timezone`. Live holds are added up only
 * for the departures already inside the dates, and the dates' outer
 * bounds in UTC let the partial index on `starts_at` find them
 * (`IDX_booking_slot_open_starts_at`).
 */

/** Dates as a shopper asks them: days (both ends included) or whole months. */
export type DepartureDates = { ranges: { from: string; to: string }[] } | { months: string[] }

export interface DepartureQuery {
  dates: DepartureDates
  /** Places the party takes; at least 1. */
  pax: number
  now: Date
}

/** A product's first departure that matches. */
export interface DepartureMatch {
  product_id: string
  slot_id: string
  starts_at: Date
  /** Places free on it now. */
  left: number
}

/** A local day span, `to` the first day after it. */
export interface LocalSpan {
  from: string
  to: string
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH = /^(\d{4})-(\d{2})$/
const HOUR = 60 * 60 * 1000
// No zone is further from UTC than this (Kiribati +14, Baker Island −12)
const ZONE_REACH = 14 * HOUR

const isoDay = (date: Date) => date.toISOString().slice(0, 10)

function dayAfter(day: string): string {
  const match = DAY.exec(day)
  if (!match) {
    throw new Error(`booking: not a day: ${day}`)
  }
  return isoDay(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1)))
}

function monthSpan(month: string): LocalSpan {
  const match = MONTH.exec(month)
  if (!match) {
    throw new Error(`booking: not a month: ${month}`)
  }
  const year = Number(match[1])
  const index = Number(match[2]) - 1
  return {
    from: isoDay(new Date(Date.UTC(year, index, 1))),
    to: isoDay(new Date(Date.UTC(year, index + 1, 1))),
  }
}

/** The dates as local day spans (each end a local midnight, `to` excluded). */
export function localSpans(dates: DepartureDates): LocalSpan[] {
  if ("months" in dates) {
    return dates.months.map(monthSpan)
  }
  return dates.ranges.map((range) => {
    if (!DAY.test(range.from)) {
      throw new Error(`booking: not a day: ${range.from}`)
    }
    return { from: range.from, to: dayAfter(range.to) }
  })
}

/** The spans' outer bounds in UTC, wide enough for any zone, never before `now`. */
export function outerBounds(spans: readonly LocalSpan[], now: Date): { from: Date; to: Date } {
  const starts = spans.map((span) => Date.parse(`${span.from}T00:00:00Z`) - ZONE_REACH)
  const ends = spans.map((span) => Date.parse(`${span.to}T00:00:00Z`) + ZONE_REACH)
  return {
    from: new Date(Math.max(now.getTime(), Math.min(...starts))),
    to: new Date(Math.max(...ends)),
  }
}

/**
 * The departures inside the dates with room for the party, as one
 * statement: `c` the open departures in the spans whose sales are still
 * on (the index's range, then each product's zone), `h` their live
 * holds, then what is left of each. `bookableIds` narrows to some
 * products (a page of cards).
 */
export function windowStatement(
  query: DepartureQuery,
  bookableIds: readonly string[] | null
): { cte: string; params: unknown[] } {
  const spans = localSpans(query.dates)
  if (spans.length === 0) {
    throw new Error("booking: no dates to match")
  }
  const bounds = outerBounds(spans, query.now)
  const local = "(s.starts_at AT TIME ZONE b.timezone)"
  const inSpans = spans
    .map(() => `(${local} >= ?::timestamp AND ${local} < ?::timestamp)`)
    .join(" OR ")
  const cte = `WITH c AS MATERIALIZED (
      SELECT s.id, s.bookable_id, s.starts_at, s.ends_at, s.status, s.capacity, s.sold,
             s.price_adjustments, b.product_id
        FROM booking_slot s
        JOIN bookable b ON b.id = s.bookable_id AND b.deleted_at IS NULL AND b.mode = 'departure'
       WHERE s.status = 'open' AND s.deleted_at IS NULL
         AND s.starts_at >= ? AND s.starts_at < ?
         AND s.starts_at > ?::timestamptz + make_interval(hours => b.cutoff_hours)
         AND (${inSpans})
         AND s.capacity - s.sold >= ?
         ${bookableIds ? `AND s.bookable_id IN (${marks(bookableIds.length)})` : ""}
    ), h AS (
      SELECT hs.slot_id, SUM(hs.units)::int AS units
        FROM booking_hold_slot hs
        JOIN booking_hold bh ON bh.id = hs.hold_id AND bh.deleted_at IS NULL
       WHERE hs.deleted_at IS NULL AND bh.expires_at > now()
         AND hs.slot_id IN (SELECT id FROM c)
       GROUP BY hs.slot_id
    ), w AS (
      SELECT c.*, COALESCE(h.units, 0)::int AS held_live,
             (c.capacity - c.sold - COALESCE(h.units, 0))::int AS left_places
        FROM c LEFT JOIN h ON h.slot_id = c.id
       WHERE c.capacity - c.sold - COALESCE(h.units, 0) >= ?
    )`
  const params: unknown[] = [
    bounds.from,
    bounds.to,
    query.now,
    ...spans.flatMap((span) => [`${span.from} 00:00:00`, `${span.to} 00:00:00`]),
    query.pax,
    ...(bookableIds ?? []),
    query.pax,
  ]
  return { cte, params }
}

/** The statement `departureMatches` runs: each product's first matching departure. */
export function matchesStatement(query: DepartureQuery): { sql: string; params: unknown[] } {
  const { cte, params } = windowStatement(query, null)
  return {
    sql: `${cte}
      SELECT DISTINCT ON (w.product_id) w.product_id, w.id AS slot_id, w.starts_at, w.left_places
        FROM w ORDER BY w.product_id, w.starts_at, w.id`,
    params,
  }
}

const toDate = (value: unknown): Date => new Date(value as string | Date)

/** Each product's first matching departure, the earliest first. */
export async function departureMatches(
  manager: Executor,
  query: DepartureQuery
): Promise<DepartureMatch[]> {
  if (!Number.isInteger(query.pax) || query.pax < 1) {
    throw new Error("booking: a party is at least one place")
  }
  const { sql, params } = matchesStatement(query)
  const found = await rows(manager, sql, params)
  return found
    .map((row: Row) => ({
      product_id: String(row["product_id"]),
      slot_id: String(row["slot_id"]),
      starts_at: toDate(row["starts_at"]),
      left: asInt(row["left_places"]),
    }))
    .sort(
      (a, b) =>
        a.starts_at.getTime() - b.starts_at.getTime() ||
        (a.product_id < b.product_id ? -1 : a.product_id > b.product_id ? 1 : 0)
    )
}

/**
 * Some bookables' matching departures inside the dates, by bookable and
 * start, at most `limit` each: a page of cards priced over the dates
 * asked (adr/0077 §4).
 */
export async function windowSlotsOf(
  manager: Executor,
  bookableIds: readonly string[],
  query: DepartureQuery,
  limit: number
): Promise<SlotAvailability[]> {
  if (bookableIds.length === 0) {
    return []
  }
  const { cte, params } = windowStatement(query, bookableIds)
  const found = await rows(
    manager,
    `${cte}
     SELECT * FROM (
       SELECT w.*, ROW_NUMBER() OVER (PARTITION BY w.bookable_id ORDER BY w.starts_at, w.id) AS place
         FROM w
     ) y
     WHERE y.place <= ?
     ORDER BY y.bookable_id, y.starts_at, y.id`,
    [...params, limit]
  )
  return found.map(availabilityOf)
}
