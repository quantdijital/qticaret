import type { Translate } from "@qticaret/ui"

/**
 * A search's own narrowing (adr/0077 §2, docs/13 §7) beside the listing's
 * filters: `kategori` (a category's handle), `tarih` (`YYYY-MM-DD_YYYY-MM-DD`)
 * or `ay` (`YYYY-MM[,YYYY-MM]`), and `kisi` (2..20; 1 is never written).
 * Read here by form only: the backend checks them again (from today on,
 * the range's length, the months ahead, the shop selling dated products)
 * and answers a query it did not take whole with `canonical_query`, where
 * the page moves.
 */
export interface DatedState {
  category: string | null
  /** `tarih` as written; wins over `months`. */
  range: string | null
  /** `ay` as written. */
  months: string | null
  /** 1 when not asked. */
  pax: number
}

export const DATED_PARAMS = {
  category: "kategori",
  range: "tarih",
  months: "ay",
  pax: "kisi",
} as const

/** The search box's two day fields (a GET form cannot write `tarih=a_b`). */
export const DAY_FIELDS = { from: "tarih_baslangic", to: "tarih_bitis" } as const

export const NO_DATED: DatedState = { category: null, range: null, months: null, pax: 1 }

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const RANGE = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/
const MONTHS = /^\d{4}-\d{2}(?:,\d{4}-\d{2}){0,2}$/
const PAX = /^[1-9]\d?$/
export const MAX_PAX = 20

/** Every name the search's narrowing takes in an address: none of them is a filter. */
export const DATED_NAMES: ReadonlySet<string> = new Set([
  ...Object.values(DATED_PARAMS),
  ...Object.values(DAY_FIELDS),
])

const last = (search: URLSearchParams, name: string) => search.getAll(name).at(-1)?.trim() ?? ""

/** The narrowing as written in the address, each part by form; none of it: `NO_DATED`. */
export function datedFromSearch(search: URLSearchParams): DatedState {
  const category = last(search, DATED_PARAMS.category)
  const range = last(search, DATED_PARAMS.range)
  const months = last(search, DATED_PARAMS.months)
  const pax = last(search, DATED_PARAMS.pax)
  const isRange = RANGE.test(range)
  return {
    category: HANDLE.test(category) && category.length <= 200 ? category : null,
    range: isRange ? range : null,
    months: !isRange && MONTHS.test(months) ? months : null,
    pax: PAX.test(pax) && Number(pax) <= MAX_PAX ? Number(pax) : 1,
  }
}

/** Whether the search is narrowed by any of them. */
export const isDated = (state: DatedState): boolean =>
  state.category !== null || state.range !== null || state.months !== null

/** The parameters in the backend's canonical order (`listingSearch`): after the filters. */
export function appendDated(params: URLSearchParams, state: DatedState | undefined): void {
  if (!state) {
    return
  }
  if (state.category) {
    params.append(DATED_PARAMS.category, state.category)
  }
  if (state.range) {
    params.append(DATED_PARAMS.range, state.range)
  } else if (state.months) {
    params.append(DATED_PARAMS.months, state.months)
  }
  if (state.pax > 1) {
    params.append(DATED_PARAMS.pax, String(state.pax))
  }
}

/**
 * The search box's two day fields as one range: one day alone is that
 * day, two the other way round are put in order; null when neither is a
 * day. The backend decides whether the range is one it answers.
 */
export function rangeOfDays(from: string, to: string): string | null {
  const start = DAY.test(from) ? from : null
  const end = DAY.test(to) ? to : null
  const first = start ?? end
  const second = end ?? start
  if (first === null || second === null) {
    return null
  }
  return first <= second ? `${first}_${second}` : `${second}_${first}`
}

/**
 * Whether the address came from the search box as a GET form sends it:
 * its day fields, an empty field (`kategori=`), the default party
 * (`kisi=1`). Such an address moves once to its clean form.
 */
export function isFormAddress(search: URLSearchParams): boolean {
  return [...search.entries()].some(
    ([name, value]) =>
      name === DAY_FIELDS.from ||
      name === DAY_FIELDS.to ||
      value.trim() === "" ||
      (name === DATED_PARAMS.pax && value.trim() === "1")
  )
}

/** The narrowing with the box's day fields read as a range (which then wins over a month). */
export function datedFromForm(search: URLSearchParams): DatedState {
  const read = datedFromSearch(search)
  const range = rangeOfDays(last(search, DAY_FIELDS.from), last(search, DAY_FIELDS.to))
  return range ? { ...read, range, months: null } : read
}

const MONTH_NAMES = (month: number, style: "long" | "short") =>
  new Intl.DateTimeFormat("tr-TR", { month: style, timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, month - 1, 1))
  )

/** "1–10 Ara", "28 Kas – 3 Ara", "5 Ara": a range in words, without the year. */
export function rangeWords(range: string): string | null {
  const match = RANGE.exec(range)
  if (!match?.[1] || !match[2]) {
    return null
  }
  const [from, to] = [match[1], match[2]]
  const day = (value: string) => Number(value.slice(8, 10))
  const month = (value: string) => MONTH_NAMES(Number(value.slice(5, 7)), "short")
  if (from === to) {
    return `${day(from)} ${month(from)}`
  }
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${day(from)}–${day(to)} ${month(to)}`
  }
  return `${day(from)} ${month(from)} – ${day(to)} ${month(to)}`
}

/** "Aralık 2026": a month (`YYYY-MM`) in words. */
export const monthWords = (month: string): string =>
  `${MONTH_NAMES(Number(month.slice(5, 7)), "long")} ${month.slice(0, 4)}`

/** The dates and the party in words ("1–10 Ara", "Aralık 2026, Ocak 2027", "2 kişi"). */
export function datedWords(state: DatedState, t: Translate): string[] {
  const dates = state.range
    ? rangeWords(state.range)
    : state.months
      ? state.months.split(",").map(monthWords).join(", ")
      : null
  return [
    ...(dates ? [dates] : []),
    ...(state.pax > 1 ? [t("search.form_people_count", { count: state.pax })] : []),
  ]
}

/** The dates and party a date search's cards are asked with; null without dates. */
export function cardDatesOf(state: DatedState | undefined): Record<string, string | number> | null {
  const [from, to] = state?.range?.split("_") ?? []
  const dates = from && to ? { from, to } : state?.months ? { months: state.months } : null
  if (!dates || !state) {
    return null
  }
  return state.pax > 1 ? { ...dates, pax: state.pax } : dates
}
