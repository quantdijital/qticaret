import { ValidationError } from "../../lib/errors"
import { MAX_UNITS, asInt, marks, rows } from "./sql"
import type { Executor, Row } from "./sql"
import { availabilityOf } from "./availability"
import type { SlotAvailability } from "./availability"

/**
 * Dated products found by their departures (adr/0077 §3): a departure
 * matches when it is open, its sales have not closed (`cutoff_hours`), it
 * starts inside the dates asked, and its free places (capacity − sold −
 * live holds) cover the party. Dates are the product's own: a day or a
 * month starts and ends in its `timezone`. Live holds are added up only
 * for the departures already inside the dates, and each span's bounds
 * in UTC let the partial index on `starts_at` find them
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
// Years a departure is searched in; a date outside is no shopper's (and no Date's)
const FIRST_YEAR = 2000
const LAST_YEAR = 9000
// Spans one search reads at most (three months, one range)
const MAX_SPANS = 3

/** Products one date search answers at most, the nearest first (adr/0077 Riskler). */
export const MAX_MATCHES = 1000

const refused = (): ValidationError =>
  new ValidationError("booking.dates_invalid", { field: "dates" })

// A real calendar day's UTC midnight inside the years searched
function dayTime(day: string): number {
  const match = DAY.exec(day)
  const year = Number(match?.[1])
  const time = Date.UTC(year, Number(match?.[2]) - 1, Number(match?.[3]))
  if (!match || year < FIRST_YEAR || year > LAST_YEAR || Number.isNaN(time)) {
    throw refused()
  }
  if (new Date(time).toISOString().slice(0, 10) !== day) {
    throw refused()
  }
  return time
}

const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10)

function monthSpan(month: string): LocalSpan {
  const match = MONTH.exec(month)
  const year = Number(match?.[1])
  const index = Number(match?.[2]) - 1
  if (!match || year < FIRST_YEAR || year > LAST_YEAR || index < 0 || index > 11) {
    throw refused()
  }
  return {
    from: isoDay(Date.UTC(year, index, 1)),
    to: isoDay(Date.UTC(year, index + 1, 1)),
  }
}

/** The dates as local day spans (each end a local midnight, `to` excluded). */
export function localSpans(dates: DepartureDates): LocalSpan[] {
  const spans =
    "months" in dates
      ? dates.months.map(monthSpan)
      : dates.ranges.map((range) => {
          const from = dayTime(range.from)
          const to = dayTime(range.to)
          if (to < from) {
            throw refused()
          }
          return { from: range.from, to: isoDay(to + 24 * HOUR) }
        })
  if (spans.length === 0 || spans.length > MAX_SPANS) {
    throw refused()
  }
  return spans
}

/** A span's bounds in UTC, wide enough for any zone, never before `now`; null when it has passed. */
export function spanBounds(span: LocalSpan, now: Date): { from: Date; to: Date } | null {
  const from = Math.max(now.getTime(), Date.parse(`${span.from}T00:00:00Z`) - ZONE_REACH)
  const to = Date.parse(`${span.to}T00:00:00Z`) + ZONE_REACH
  return from < to ? { from: new Date(from), to: new Date(to) } : null
}

/**
 * The departures inside the dates with room for the party, as one
 * statement: `c` the open departures in the spans whose sales are still
 * on (each span its own range on the index, then the product's zone), `h`
 * their live holds, then what is left of each. `bookableIds` narrows to
 * some products (a page of cards). A month apart from the next is read
 * on its own: what lies between them is never read.
 */
export function windowStatement(
  query: DepartureQuery,
  bookableIds: readonly string[] | null
): { cte: string; params: unknown[] } {
  const spans = localSpans(query.dates).flatMap((span) => {
    const bounds = spanBounds(span, query.now)
    return bounds ? [{ span, bounds }] : []
  })
  const local = "(s.starts_at AT TIME ZONE b.timezone)"
  const inSpans =
    spans
      .map(
        () =>
          `(s.starts_at >= ? AND s.starts_at < ? AND ${local} >= ?::timestamp AND ${local} < ?::timestamp)`
      )
      .join(" OR ") || "false"
  const cte = `WITH c AS MATERIALIZED (
      SELECT s.id, s.bookable_id, s.starts_at, s.ends_at, s.status, s.capacity, s.sold,
             s.price_adjustments, b.product_id, b.timezone
        FROM booking_slot s
        JOIN bookable b ON b.id = s.bookable_id AND b.deleted_at IS NULL AND b.mode = 'departure'
       WHERE s.status = 'open' AND s.deleted_at IS NULL
         AND (${inSpans})
         AND s.starts_at > ?::timestamptz + make_interval(hours => b.cutoff_hours)
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
    ...spans.flatMap(({ span, bounds }) => [
      bounds.from,
      bounds.to,
      `${span.from} 00:00:00`,
      `${span.to} 00:00:00`,
    ]),
    query.now,
    query.pax,
    ...(bookableIds ?? []),
    query.pax,
  ]
  return { cte, params }
}

/**
 * The statement `departureMatches` runs: each product's first matching
 * departure, then the nearest `limit` of them.
 */
export function matchesStatement(
  query: DepartureQuery,
  limit: number = MAX_MATCHES
): { sql: string; params: unknown[] } {
  const { cte, params } = windowStatement(query, null)
  return {
    sql: `${cte}
      SELECT * FROM (
        SELECT DISTINCT ON (w.product_id) w.product_id, w.id AS slot_id, w.starts_at, w.left_places
          FROM w ORDER BY w.product_id, w.starts_at, w.id
      ) d
      ORDER BY d.starts_at, d.product_id
      LIMIT ?`,
    params: [...params, limit],
  }
}

const toDate = (value: unknown): Date => new Date(value as string | Date)

/** Each product's first matching departure, the earliest first, at most MAX_MATCHES. */
export async function departureMatches(
  manager: Executor,
  query: DepartureQuery
): Promise<DepartureMatch[]> {
  if (!Number.isInteger(query.pax) || query.pax < 1 || query.pax > MAX_UNITS) {
    throw new ValidationError("booking.units_invalid", { field: "pax" })
  }
  const { sql, params } = matchesStatement(query)
  const found = await rows(manager, sql, params)
  return found.map((row: Row) => ({
    product_id: String(row["product_id"]),
    slot_id: String(row["slot_id"]),
    starts_at: toDate(row["starts_at"]),
    left: asInt(row["left_places"]),
  }))
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
