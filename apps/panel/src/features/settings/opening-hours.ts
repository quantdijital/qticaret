import type { OpeningRange } from "@/features/settings/api/sections"

/**
 * The opening hours editor's rules (adr/0048), the server's mirrored
 * (backend `lib/shop/hours.ts`): ISO weekdays 1 (Monday) … 7, `HH:MM`, a
 * range closes after it opens and never overlaps another on its day. In
 * the editor a closing time of 00:00 is midnight (stored as `24:00`, which
 * a time field cannot show).
 */

export const DAY_COUNT = 7
/** Three ranges a day: 21 at most, the server's limit. */
export const MAX_RANGES_PER_DAY = 3
/** Monday … Friday, by index. */
const WEEKDAYS = [0, 1, 2, 3, 4] as const

export interface TimeRange {
  opens: string
  closes: string
}

/** One day as the editor holds it: closed keeps its ranges, so opening it again brings them back. */
export interface DayHours {
  open: boolean
  ranges: TimeRange[]
}

export type HoursIssue = "required" | "backwards" | "overlap"

export const DEFAULT_RANGE: TimeRange = { opens: "09:00", closes: "18:00" }

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const DAY_MINUTES = 24 * 60
const LUNCH = { start: 12 * 60, end: 13 * 60 }

/** Minutes since midnight; a closing 00:00 is the day's end. Null when not a time. */
export function minutesOf(time: string, closing = false): number | null {
  if (!TIME.test(time)) {
    return null
  }
  const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  return closing && minutes === 0 ? DAY_MINUTES : minutes
}

const timeOf = (minutes: number): string =>
  minutes >= DAY_MINUTES
    ? "00:00"
    : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`

/** The stored ranges as seven days; a day without one is closed, offered 09:00–18:00 when opened. */
export function daysOf(saved: readonly OpeningRange[]): DayHours[] {
  return Array.from({ length: DAY_COUNT }, (_, index) => {
    const ranges = saved
      .filter((range) => range.day === index + 1)
      .map(({ opens, closes }) => ({ opens, closes: closes === "24:00" ? "00:00" : closes }))
    return ranges.length > 0
      ? { open: true, ranges }
      : { open: false, ranges: [{ ...DEFAULT_RANGE }] }
  })
}

/** The open days' ranges as the server takes them, sorted by day and opening. */
export function rangesOf(days: readonly DayHours[]): OpeningRange[] {
  return days.flatMap((day, index) =>
    day.open
      ? [...day.ranges]
          .sort((a, b) => (minutesOf(a.opens) ?? 0) - (minutesOf(b.opens) ?? 0))
          .map(({ opens, closes }) => ({
            day: index + 1,
            opens,
            closes: closes === "00:00" ? "24:00" : closes,
          }))
      : []
  )
}

/** What is wrong with each range of an open day, in its own order; a closed day is not read. */
export function hoursIssues(days: readonly DayHours[]): (HoursIssue | null)[][] {
  return days.map((day) => {
    if (!day.open) {
      return day.ranges.map(() => null)
    }
    const issues: (HoursIssue | null)[] = day.ranges.map(({ opens, closes }) => {
      const from = minutesOf(opens)
      const to = minutesOf(closes, true)
      if (from === null || to === null) {
        return "required"
      }
      return to <= from ? "backwards" : null
    })
    // In opening order, a range that opens before the one ahead of it closes overlaps it
    const order = day.ranges
      .map((range, index) => ({
        index,
        from: minutesOf(range.opens),
        to: minutesOf(range.closes, true),
      }))
      .filter((entry) => issues[entry.index] === null)
      .sort((a, b) => (a.from ?? 0) - (b.from ?? 0))
    order.forEach((entry, position) => {
      const previous = order[position - 1]
      if (previous && (entry.from ?? 0) < (previous.to ?? 0)) {
        issues[entry.index] = "overlap"
      }
    })
    return issues
  })
}

/**
 * A break in the day's last range: lunch (12:00–13:00) when it fits inside,
 * else an hour in its middle; a range too short for one gets a new range
 * after it (empty to fill in when the day is over).
 */
export function withBreak(ranges: readonly TimeRange[]): TimeRange[] {
  const last = ranges.at(-1)
  const from = last ? minutesOf(last.opens) : null
  const to = last ? minutesOf(last.closes, true) : null
  if (!last || from === null || to === null || to <= from) {
    return [...ranges, { opens: "", closes: "" }]
  }
  const head = ranges.slice(0, -1)
  if (from < LUNCH.start && to > LUNCH.end) {
    return [
      ...head,
      { opens: last.opens, closes: timeOf(LUNCH.start) },
      { opens: timeOf(LUNCH.end), closes: last.closes },
    ]
  }
  if (to - from >= 3 * 60) {
    const start = from + Math.floor((to - from - 60) / 2 / 30) * 30
    return [
      ...head,
      { opens: last.opens, closes: timeOf(start) },
      { opens: timeOf(start + 60), closes: last.closes },
    ]
  }
  return to + 60 <= DAY_MINUTES
    ? [...ranges, { opens: timeOf(to), closes: timeOf(to + 60) }]
    : [...ranges, { opens: "", closes: "" }]
}

/** Monday's hours, open or closed, on Tuesday to Friday too. */
export function mondayToWeekdays(days: readonly DayHours[]): DayHours[] {
  const monday = days[0]
  if (!monday) {
    return [...days]
  }
  return days.map((day, index) =>
    index !== 0 && (WEEKDAYS as readonly number[]).includes(index)
      ? { open: monday.open, ranges: monday.ranges.map((range) => ({ ...range })) }
      : day
  )
}
