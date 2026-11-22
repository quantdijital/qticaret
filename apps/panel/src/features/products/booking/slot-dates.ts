/**
 * Departure times in the product's own zone (adr/0076 §3, `Europe/Istanbul`
 * unless set): what staff type is the wall clock there, whatever the
 * browser's zone; the server gets ISO 8601 with that zone's offset.
 */

export const DEFAULT_ZONE = "Europe/Istanbul"

/** The most departures one repeating rule makes in a save (the server takes 100). */
export const RECURRING_MAX = 60

// Two years of days: a longer range is a typo, not a season
const MAX_DAYS = 731

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

const pad = (value: number) => String(value).padStart(2, "0")

/** Minutes the zone is ahead of UTC at a moment. */
function offsetMinutes(at: number, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at))
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0")
  const wall = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second")
  )
  return Math.round((wall - Math.floor(at / 1000) * 1000) / 60_000)
}

/** A wall clock time (`2027-05-01T09:00`) in the zone as ISO 8601 with its offset; null when unreadable. */
export function zonedIso(local: string, zone: string = DEFAULT_ZONE): string | null {
  const match = LOCAL.exec(local)
  if (!match) {
    return null
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ]
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  const check = new Date(wall)
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null
  }
  // The offset at the guess, then at the moment it gives (a clock change between the two)
  let offset = offsetMinutes(wall - offsetMinutes(wall, zone) * 60_000, zone)
  offset = offsetMinutes(wall - offset * 60_000, zone)
  const sign = offset < 0 ? "-" : "+"
  const abs = Math.abs(offset)
  return `${local}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** A moment as the zone's wall clock (`2027-05-01T09:00`), for a field's value. */
export function localOf(iso: string, zone: string = DEFAULT_ZONE): string {
  const at = new Date(iso).getTime()
  const shifted = new Date(at + offsetMinutes(at, zone) * 60_000)
  return `${String(shifted.getUTCFullYear())}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
}

/** A departure's start for a list: "Cmt 1 May 2027 09:00" in the zone. */
export function formatSlotStart(iso: string, zone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export interface RecurringRule {
  /** First and last day, `YYYY-MM-DD`, both taken. */
  from: string
  to: string
  /** 0 Sunday … 6 Saturday. */
  weekdays: readonly number[]
  /** `HH:mm` on each of those days. */
  time: string
  zone?: string
  /** Starts before this are skipped (a past day in the range). */
  now?: Date
  limit?: number
}

export interface RecurringStarts {
  /** ISO 8601 with offset, earliest first, at most `limit`. */
  starts: string[]
  /** More days matched than the limit took. */
  more: boolean
}

/**
 * The starts a repeating rule makes ("every Saturday at 09:00 from May to
 * June"), made here and sent as one list; past ones left out.
 */
export function recurringStarts(rule: RecurringRule): RecurringStarts {
  const zone = rule.zone ?? DEFAULT_ZONE
  const limit = rule.limit ?? RECURRING_MAX
  const now = (rule.now ?? new Date()).getTime()
  const from = DAY.exec(rule.from)
  const to = DAY.exec(rule.to)
  if (!from || !to || !TIME.test(rule.time) || rule.weekdays.length === 0) {
    return { starts: [], more: false }
  }
  const first = Date.UTC(Number(from[1]), Number(from[2]) - 1, Number(from[3]))
  const last = Date.UTC(Number(to[1]), Number(to[2]) - 1, Number(to[3]))
  const days = new Set(rule.weekdays)
  const starts: string[] = []
  for (let at = first, step = 0; at <= last && step < MAX_DAYS; at += 86_400_000, step += 1) {
    const date = new Date(at)
    if (!days.has(date.getUTCDay())) {
      continue
    }
    const day = `${String(date.getUTCFullYear())}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
    const iso = zonedIso(`${day}T${rule.time}`, zone)
    if (iso === null || new Date(iso).getTime() <= now) {
      continue
    }
    if (starts.length === limit) {
      return { starts, more: true }
    }
    starts.push(iso)
  }
  return { starts, more: false }
}
