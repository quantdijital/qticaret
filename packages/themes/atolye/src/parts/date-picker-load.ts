import type { SearchCalendarDayView, SearchCalendarMonthView } from "@qticaret/ui"

/**
 * The calendar's months from the storefront (adr/0077 §6): asked only
 * once the calendar is open, one month at a time, each answer kept for
 * the page's life under its question (the month, the category, the
 * party), so going back a month asks nothing. A month the storefront
 * refused for load (429) or could not answer (5xx) is not asked again for
 * `FAILED_HOLD_MS` (#310 review D2): the calendar shows it without prices.
 */

export type MonthDays = ReadonlyMap<string, SearchCalendarDayView>

/** How long a refused or failed month is not asked again. */
export const FAILED_HOLD_MS = 30_000

/** The pause after the shown month changes before it is asked: paging through asks once. */
export const MONTH_DELAY_MS = 200

const kept = new Map<string, MonthDays>()
/** Addresses that failed, and until when they are not asked again. */
const failed = new Map<string, number>()

/**
 * What is known of a month without asking: its days, null while its
 * failure is held, undefined when it is to be asked.
 */
export function keptMonth(address: string, now = Date.now()): MonthDays | null | undefined {
  const days = kept.get(address)
  if (days) {
    return days
  }
  const until = failed.get(address)
  if (until !== undefined && until > now) {
    return null
  }
  failed.delete(address)
  return undefined
}

const isMonth = (value: unknown): value is SearchCalendarMonthView =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as SearchCalendarMonthView).days)

/** The address asked: the month, then the form's category and party when it has them. */
export function calendarAddress(
  url: string,
  month: string,
  narrowing: { category: string; pax: string }
): string {
  const query = new URLSearchParams({ month })
  if (narrowing.category) {
    query.set("kategori", narrowing.category)
  }
  if (narrowing.pax && narrowing.pax !== "1") {
    query.set("kisi", narrowing.pax)
  }
  return `${url}?${query.toString()}`
}

/** The month's days by date; a failure throws (the calendar still picks days). */
export async function loadMonth(address: string, signal: AbortSignal): Promise<MonthDays> {
  const known = keptMonth(address)
  if (known) {
    return known
  }
  if (known === null) {
    throw new Error("calendar month held after a failure")
  }
  const response = await fetch(address, {
    signal,
    headers: { accept: "application/json" },
    credentials: "same-origin",
  })
  if (response.status === 429 || response.status >= 500) {
    failed.set(address, Date.now() + FAILED_HOLD_MS)
  }
  const body: unknown = response.ok ? await response.json() : null
  if (!isMonth(body)) {
    throw new Error(`calendar answered ${String(response.status)}`)
  }
  const days = new Map(body.days.map((day) => [day.date, day]))
  kept.set(address, days)
  return days
}

/** The form's category and party as chosen now ("" none). */
export function narrowingOf(form: HTMLFormElement | null): { category: string; pax: string } {
  if (!form) {
    return { category: "", pax: "" }
  }
  const data = new FormData(form)
  const text = (name: string) => {
    const value = data.get(name)
    return typeof value === "string" ? value : ""
  }
  return { category: text("kategori"), pax: text("kisi") }
}
