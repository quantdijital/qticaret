/**
 * The search calendar's arithmetic (adr/0077 §6), no React and no date
 * library: days as `YYYY-MM-DD`, months as `YYYY-MM`, counted in UTC so a
 * day is a day wherever the browser is. The bounds are the form's own
 * (`min` today in the shop's zone, `max` the last month's last day).
 */

const DAY_MS = 86_400_000

const utc = (day: string) =>
  Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))

const written = (time: number) => new Date(time).toISOString().slice(0, 10)

/** The day `count` days after `day` (before, when negative). */
export const addDays = (day: string, count: number): string => written(utc(day) + count * DAY_MS)

/** How many days a range holds, both ends included. */
export const daysIn = (from: string, to: string): number => (utc(to) - utc(from)) / DAY_MS + 1

/** `YYYY-MM` `count` months after `month`. */
export function addMonths(month: string, count: number): string {
  const at = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + count
  return `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, "0")}`
}

export const monthOf = (day: string): string => day.slice(0, 7)

/**
 * A month as weeks, Monday first: each week seven cells, a day or null
 * where the week runs into the month before or after.
 */
export function monthWeeks(month: string): (string | null)[][] {
  const first = `${month}-01`
  const length = daysIn(first, addDays(`${addMonths(month, 1)}-01`, -1))
  // getUTCDay: Sunday 0; Monday first puts it last
  const lead = (new Date(utc(first)).getUTCDay() + 6) % 7
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, index) => addDays(first, index)),
  ]
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
}

export interface DayRange {
  /** "" none. */
  from: string
  /** "" none: the end still to pick (or the one day). */
  to: string
}

export interface Bounds {
  /** The first day a search takes (today). */
  min: string
  /** The last day a search takes. */
  max: string
  /** A range's most days, both ends included. */
  maxDays: number
}

/**
 * Whether a day can be pressed now: within the bounds and, while a start
 * waits for its end, not more than `maxDays` from it (a day before the
 * start starts again).
 */
export function canPick(range: DayRange, day: string, bounds: Bounds): boolean {
  if (day < bounds.min || day > bounds.max) {
    return false
  }
  return !(range.from && !range.to && day > range.from && daysIn(range.from, day) > bounds.maxDays)
}

/**
 * A day pressed: the first starts a range, the second ends it (a day
 * before the start, or a press on a whole range, starts again; the start
 * pressed again is the one day). A day it cannot take changes nothing.
 */
export function pickDay(range: DayRange, day: string, bounds: Bounds): DayRange {
  if (!canPick(range, day, bounds)) {
    return range
  }
  if (!range.from || range.to || day < range.from) {
    return { from: day, to: "" }
  }
  return { from: range.from, to: day }
}

/** Where a day stands in the range, for its look. */
export function dayPlace(range: DayRange, day: string): "start" | "end" | "inside" | null {
  if (day === range.from) {
    return "start"
  }
  if (range.to && day === range.to) {
    return "end"
  }
  return range.from && range.to && day > range.from && day < range.to ? "inside" : null
}

/**
 * A flexible month pressed: off when on; on, in order, while fewer than
 * `max` are; the same months otherwise (`full` true).
 */
export function toggleMonth(
  months: readonly string[],
  month: string,
  max: number
): { months: string[]; full: boolean } {
  if (months.includes(month)) {
    return { months: months.filter((each) => each !== month), full: false }
  }
  if (months.length >= max) {
    return { months: [...months], full: true }
  }
  return { months: [...months, month].sort(), full: false }
}

const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

/** The same day `count` months on; a 31st into a shorter month its last day. */
function pagedDay(day: string, count: number): string {
  const month = addMonths(monthOf(day), count)
  const last = addDays(`${addMonths(month, 1)}-01`, -1)
  const wanted = `${month}-${day.slice(8, 10)}`
  return wanted > last ? last : wanted
}

/**
 * The day a key moves the focus to: the arrows a day or a week, Page Up
 * and Page Down a month; held within the bounds. null: not a moving key.
 */
export function movedDay(day: string, key: string, bounds: Bounds): string | null {
  const step = STEPS[key]
  const next =
    step !== undefined
      ? addDays(day, step)
      : key === "PageUp" || key === "PageDown"
        ? pagedDay(day, key === "PageUp" ? -1 : 1)
        : null
  if (next === null) {
    return null
  }
  return next < bounds.min ? bounds.min : next > bounds.max ? bounds.max : next
}

/** A template's `{name}`s filled. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, name: string) =>
    values[name] === undefined ? match : String(values[name])
  )

export type PickerMode = "exact" | "flexible"

/** What the dates fields hold: a range ("" none) or up to three months. */
export interface DatesChoice {
  from: string
  to: string
  months: string[]
}

/** What Apply writes: the open tab's choice wins; an empty one keeps the other's. */
export function applied(mode: PickerMode, range: DayRange, months: string[]): DatesChoice {
  const days = { from: range.from, to: range.to || range.from }
  if (mode === "exact") {
    return range.from ? { ...days, months: [] } : { from: "", to: "", months }
  }
  return months.length > 0 ? { from: "", to: "", months } : { ...days, months: [] }
}
