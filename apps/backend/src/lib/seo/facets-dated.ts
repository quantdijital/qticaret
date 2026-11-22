/**
 * A listing's date search (adr/0077 §2, docs/13 §7): `kategori` (a
 * category's handle, its subtree included; a search's), `tarih`
 * (`YYYY-MM-DD_YYYY-MM-DD`, from today on, at most 62 days), `ay`
 * (`YYYY-MM[,YYYY-MM]`, at most 3, within the next 12 months) and `kisi`
 * (`1..20`, 1 never written). `tarih` and `ay` together keep `tarih`.
 * The dates and the party are read only while the shop sells dated
 * products (`catalog.booking`); otherwise they are dropped and the page
 * moves (301) to the address without them. Pure: the caller knows
 * today's date in the shop's zone.
 */

export const DATED_PARAMS = {
  category: "kategori",
  dates: "tarih",
  months: "ay",
  pax: "kisi",
} as const

/** `sirala`'s value for the nearest departure first. */
export const DEPARTURE_SORT = "kalkis"

/** A range's most days, both ends included. */
export const MAX_RANGE_DAYS = 62
/** Months asked at once at most. */
export const MAX_MONTHS = 3
/** How far ahead a month may be: this month and the next eleven. */
export const MONTHS_AHEAD = 12
export const MAX_PAX = 20

/** The shop's zone, where "today" is read (the products' default zone, adr/0076). */
export const SHOP_TIMEZONE = "Europe/Istanbul"

export type ListingDates =
  { kind: "range"; from: string; to: string } | { kind: "months"; months: string[] }

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const RANGE = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/
const MONTH = /^(\d{4})-(\d{2})$/
const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PAX = /^[1-9]\d?$/
const DAY_MS = 24 * 60 * 60 * 1000

/** Today's date in the shop's zone, `YYYY-MM-DD`. */
export function todayIn(now: Date, timeZone: string = SHOP_TIMEZONE): string {
  // en-CA writes dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

// A real calendar day's UTC midnight, else null (2026-02-30 is none)
function dayTime(day: string): number | null {
  const match = DAY.exec(day)
  if (!match) {
    return null
  }
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Date(time).toISOString().slice(0, 10) === day ? time : null
}

/** A range from today on, its end not before its start, at most MAX_RANGE_DAYS; else null. */
export function rangeOf(raw: string | undefined, today: string): ListingDates | null {
  const match = raw === undefined ? null : RANGE.exec(raw)
  const from = match?.[1]
  const to = match?.[2]
  if (from === undefined || to === undefined) {
    return null
  }
  const start = dayTime(from)
  const end = dayTime(to)
  const first = dayTime(today)
  if (start === null || end === null || first === null || start < first || end < start) {
    return null
  }
  return (end - start) / DAY_MS + 1 > MAX_RANGE_DAYS ? null : { kind: "range", from, to }
}

const monthIndex = (year: number, month: number) => year * 12 + (month - 1)

/**
 * The months asked within this month and the next eleven, sorted and
 * distinct, the first MAX_MONTHS; null when none is.
 */
export function monthsOf(raw: string | undefined, today: string): ListingDates | null {
  const now = DAY.exec(today)
  if (raw === undefined || !now) {
    return null
  }
  const first = monthIndex(Number(now[1]), Number(now[2]))
  const months = [
    ...new Set(
      raw.split(",").flatMap((each) => {
        const match = MONTH.exec(each.trim())
        if (!match) {
          return []
        }
        const month = Number(match[2])
        const at = monthIndex(Number(match[1]), month)
        return month >= 1 && month <= 12 && at >= first && at < first + MONTHS_AHEAD
          ? [each.trim()]
          : []
      })
    ),
  ]
    .sort()
    .slice(0, MAX_MONTHS)
  return months.length > 0 ? { kind: "months", months } : null
}

/** The party's places, 1 when not asked or not 1..20. */
export const paxOf = (raw: string | undefined): number =>
  raw !== undefined && PAX.test(raw) && Number(raw) <= MAX_PAX ? Number(raw) : 1

/** A category handle as written, else null. */
export const categoryOf = (raw: string | undefined): string | null =>
  raw !== undefined && HANDLE.test(raw) && raw.length <= 200 ? raw : null

/** The dates' parameter as written in the canonical form. */
export function datesParam(dates: ListingDates): [string, string] {
  return dates.kind === "range"
    ? [DATED_PARAMS.dates, `${dates.from}_${dates.to}`]
    : [DATED_PARAMS.months, dates.months.join(",")]
}

/** The dates read: a range wins over months; null when neither is valid. */
export const datesOf = (
  range: string | undefined,
  months: string | undefined,
  today: string
): ListingDates | null => rangeOf(range, today) ?? monthsOf(months, today)
