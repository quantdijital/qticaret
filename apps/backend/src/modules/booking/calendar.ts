import { ValidationError } from "../../lib/errors"
import { windowStatement } from "./matches"
import { MAX_UNITS, asInt, rows } from "./sql"
import type { Executor, Row } from "./sql"

/**
 * A month's departures day by day (adr/0077 §6): the departures a date
 * search would match (open, sales still on, room for the party after
 * sold places and live holds; `matches.ts`), counted per local day in
 * their product's zone and per bookable, with each distinct set of price
 * differences on that day. The caller prices them (base prices live in
 * Medusa's pricing, not here) and folds the bookables into days.
 */

export interface CalendarQuery {
  /** `YYYY-MM`; read in each product's own zone. */
  month: string
  pax: number
  now: Date
}

/** A bookable's departures on one local day. */
export interface CalendarRow {
  /** `YYYY-MM-DD` in the product's zone. */
  day: string
  bookable_id: string
  departures: number
  /** Each distinct set of differences (variant id → kuruş) among them; null: none. */
  adjustments: (Record<string, number> | null)[]
}

/** The statement: one read, grouped by local day and bookable, every value bound. */
export function calendarStatement(
  bookableIds: readonly string[],
  query: CalendarQuery
): { sql: string; params: unknown[] } {
  const { cte, params } = windowStatement(
    { dates: { months: [query.month] }, pax: query.pax, now: query.now },
    bookableIds
  )
  return {
    sql: `${cte}
      SELECT to_char(w.starts_at AT TIME ZONE w.timezone, 'YYYY-MM-DD') AS day, w.bookable_id,
             count(*)::int AS departures,
             jsonb_agg(DISTINCT w.price_adjustments) AS adjustments
        FROM w
       GROUP BY 1, 2
       ORDER BY 1, 2`,
    params,
  }
}

const isRecord = (value: unknown): value is Record<string, number> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const adjustmentsOf = (value: unknown): CalendarRow["adjustments"] => {
  const list: unknown = typeof value === "string" ? JSON.parse(value) : value
  return Array.isArray(list) ? list.map((each) => (isRecord(each) ? each : null)) : [null]
}

/** Some bookables' departures in the month, by local day; none asked, none read. */
export async function calendarRowsOf(
  manager: Executor,
  bookableIds: readonly string[],
  query: CalendarQuery
): Promise<CalendarRow[]> {
  if (!Number.isInteger(query.pax) || query.pax < 1 || query.pax > MAX_UNITS) {
    throw new ValidationError("booking.units_invalid", { field: "pax" })
  }
  if (bookableIds.length === 0) {
    return []
  }
  const { sql, params } = calendarStatement(bookableIds, query)
  const found = await rows(manager, sql, params)
  return found.map((row: Row) => ({
    day: String(row["day"]),
    bookable_id: String(row["bookable_id"]),
    departures: asInt(row["departures"]),
    adjustments: adjustmentsOf(row["adjustments"]),
  }))
}
