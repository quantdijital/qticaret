import type { StoreDepartureCalendar } from "@qticaret/types"
import type {
  SearchCalendarDayView,
  SearchCalendarMonthView,
  SearchFormCalendarView,
  Translate,
} from "@qticaret/ui"
import { formatLira } from "@qticaret/ui"
import { DATED_PARAMS, MAX_PAX } from "./dated-search"

/**
 * The search box's calendar (adr/0077 §6, PR6): its words for the theme,
 * and the storefront's own address in front of the backend's month
 * (`/store/departures/calendar`), which reads only what is checked here.
 */

/** Where the calendar asks for a month: the storefront's own route. */
export const SEARCH_CALENDAR_URL = "/api/search/calendar"

/** A range's most days, both ends included (the backend's `MAX_RANGE_DAYS`). */
export const MAX_RANGE_DAYS = 62
/** Flexible months at once at most (the backend's `MAX_MONTHS`). */
export const MAX_MONTHS = 3

/** The calendar as the theme draws it: the bounds and every word. */
export const calendarView = (t: Translate): SearchFormCalendarView => ({
  url: SEARCH_CALENDAR_URL,
  maxDays: MAX_RANGE_DAYS,
  maxMonths: MAX_MONTHS,
  words: {
    title: t("search.calendar_title"),
    exact: t("search.calendar_exact"),
    flexible: t("search.calendar_flexible"),
    previous: t("search.calendar_previous"),
    next: t("search.calendar_next"),
    close: t("search.calendar_close"),
    clear: t("search.calendar_clear"),
    apply: t("search.calendar_apply"),
    weekdays: t("search.calendar_weekdays").split(","),
    dayPriced: t("search.calendar_day_priced"),
    dayCounted: t("search.calendar_day_counted"),
    dayEmpty: t("search.calendar_day_empty"),
    pickStart: t("search.calendar_pick_start"),
    pickEnd: t("search.calendar_pick_end"),
    rangeLimit: t("search.calendar_range_limit", { count: MAX_RANGE_DAYS }),
    monthLimit: t("search.calendar_month_limit", { count: MAX_MONTHS }),
    loading: t("search.calendar_loading"),
    failed: t("search.calendar_failed"),
  },
})

/** What the route passes on to the backend: a month the search reads, a category, a party. */
export interface CalendarAsk {
  month: string
  category: string | null
  pax: number
}

const MONTH = /^\d{4}-\d{2}$/
const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PAX = /^[1-9]\d?$/
const KNOWN: ReadonlySet<string> = new Set(["month", DATED_PARAMS.category, DATED_PARAMS.pax])

/**
 * The calendar's question, read whole or not at all (null): one `month`
 * among the months a search reads (`months`, this one and the next
 * eleven), an optional category handle, an optional party of 1 to 20; an
 * empty category or party is none. Any other or repeated parameter is
 * refused, as the backend would.
 */
export function calendarAskOf(
  search: URLSearchParams,
  months: readonly string[]
): CalendarAsk | null {
  const names = [...search.keys()]
  if (names.some((name) => !KNOWN.has(name)) || new Set(names).size !== names.length) {
    return null
  }
  const month = search.get("month") ?? ""
  const category = search.get(DATED_PARAMS.category) ?? ""
  const pax = search.get(DATED_PARAMS.pax) ?? ""
  if (!MONTH.test(month) || !months.includes(month)) {
    return null
  }
  if (category !== "" && (!HANDLE.test(category) || category.length > 200)) {
    return null
  }
  if (pax !== "" && (!PAX.test(pax) || Number(pax) > MAX_PAX)) {
    return null
  }
  return { month, category: category || null, pax: pax ? Number(pax) : 1 }
}

/** The backend's query: the default party and no category are not written. */
export const calendarQuery = (ask: CalendarAsk): Record<string, string> => ({
  month: ask.month,
  ...(ask.category ? { [DATED_PARAMS.category]: ask.category } : {}),
  ...(ask.pax > 1 ? { [DATED_PARAMS.pax]: String(ask.pax) } : {}),
})

const SHORT = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 })
const WHOLE = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 })

function dayView(day: StoreDepartureCalendar["days"][number]): SearchCalendarDayView {
  const price = day.from_price
  return {
    date: day.date,
    departures: day.departures,
    price: price === null ? null : formatLira(price),
    short: price === null ? null : `₺${SHORT.format(price)}`,
    whole: price === null ? null : `₺${WHOLE.format(price)}`,
  }
}

/** The month as the theme reads it: each day's price written, only the asked month's days. */
export function calendarMonthView(
  month: string,
  answer: StoreDepartureCalendar
): SearchCalendarMonthView {
  return {
    month,
    days: answer.days
      .filter((day) => day.date.startsWith(`${month}-`) && day.departures > 0)
      .map(dayView),
  }
}
