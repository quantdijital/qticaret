import type { SearchFormSettings } from "@qticaret/types"
import type {
  SearchFormOptionView,
  SearchFormSelectView,
  SearchFormView,
  Translate,
} from "@qticaret/ui"
import { DATED_PARAMS, DAY_FIELDS, MAX_PAX, NO_DATED, monthWords } from "./dated-search"
import type { DatedState } from "./dated-search"
import { calendarView } from "./search-calendar"

/** Where the box sends its search. */
export const SEARCH_FORM_ACTION = "/arama"

/** How far ahead the dates reach: this month and the next eleven (the backend's `MONTHS_AHEAD`). */
const MONTHS_AHEAD = 12

/** What the box is built from: the shop's setting, flags and lists. */
export interface SearchFormSource {
  settings: SearchFormSettings
  /** The shop sells dated products (`catalog.booking`). */
  booking: boolean
  /** The shop's top categories, in its order. */
  categories: { handle: string; name: string }[]
  /** The "where" attribute's name and values; null: the shop names none, or it has none. */
  where: { label: string; options: SearchFormOptionView[] } | null
  /** Today in the shop's zone, `YYYY-MM-DD`. */
  today: string
}

/** The values a box shows chosen (a search's own on `/arama`). */
export interface SearchFormValues {
  q: string
  filters: [string, string[]][]
  dated: DatedState
}

export const EMPTY_VALUES: SearchFormValues = { q: "", filters: [], dated: NO_DATED }

/** `YYYY-MM` `count` months after `month`. */
function monthAfter(month: string, count: number): string {
  const at = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + count
  return `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, "0")}`
}

/** A month's last day, `YYYY-MM-DD`. */
function lastDay(month: string): string {
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
  return `${month}-${String(days.getUTCDate()).padStart(2, "0")}`
}

/** The months a search reads, this one first. */
export const monthsFrom = (today: string): string[] =>
  Array.from({ length: MONTHS_AHEAD }, (_, index) => monthAfter(today.slice(0, 7), index))

const listed = (options: readonly SearchFormOptionView[], value: string | null | undefined) =>
  value && options.some((option) => option.value === value) ? value : ""

function datesOf(source: SearchFormSource, dated: DatedState, t: Translate) {
  const { flexible_month, date_words } = source.settings
  const months = monthsFrom(source.today)
  const [from = "", to = ""] = dated.range ? dated.range.split("_") : []
  const bounds = { min: source.today, max: lastDay(months.at(-1) ?? source.today.slice(0, 7)) }
  const options = months.map((month) => ({ value: month, label: monthWords(month) }))
  return {
    label: t("search.form_dates"),
    from: { name: DAY_FIELDS.from, label: t("search.form_from"), value: from, ...bounds },
    to: { name: DAY_FIELDS.to, label: t("search.form_to"), value: to, ...bounds },
    month: {
      name: DATED_PARAMS.months,
      label: t("search.form_month"),
      anyLabel: t("search.form_any_time"),
      options,
      // A form takes one month; a search of several shows its first
      value: dated.range ? "" : listed(options, dated.months?.split(",")[0]),
    },
    calendar: calendarView(t),
    // Each only off its default: a box drawn as before them is the view it was
    ...(flexible_month ? {} : { flexible: false as const }),
    ...(date_words ? { hint: t("search.form_add_date") } : {}),
  }
}

function peopleOf(dated: DatedState, t: Translate): SearchFormSelectView {
  return {
    name: DATED_PARAMS.pax,
    label: t("search.form_people"),
    anyLabel: null,
    options: Array.from({ length: MAX_PAX }, (_, index) => ({
      value: String(index + 1),
      label: t("search.form_people_count", { count: index + 1 }),
    })),
    value: String(dated.pax),
  }
}

/**
 * The shop's search box (adr/0077 §1): the fields its theme setting turns
 * on, the dates and the party only while it sells dated products, the
 * categories and the "where" values only when it has some. With no
 * "where" field the box asks for words instead; with one, a search's
 * words ride along unseen. The values chosen are the search's own.
 */
export function searchFormView(
  source: SearchFormSource,
  values: SearchFormValues,
  t: Translate
): SearchFormView {
  const { settings } = source
  const key = settings.attribute_key
  const where =
    key && source.where && source.where.options.length > 0
      ? {
          name: key,
          label: source.where.label,
          anyLabel: t("search.form_any"),
          options: source.where.options,
          value: listed(
            source.where.options,
            values.filters.find(([each]) => each === key)?.[1][0]
          ),
        }
      : null
  const categories = source.categories.map(({ handle, name }) => ({ value: handle, label: name }))
  return {
    action: SEARCH_FORM_ACTION,
    label: t("search.label"),
    submit: t("search.submit"),
    ...(settings.boxed_fields ? { boxed: true as const } : {}),
    hidden: where && values.q ? [{ name: "q", value: values.q }] : [],
    words: where
      ? null
      : {
          name: "q",
          label: t("search.form_words"),
          placeholder: settings.placeholder ?? t("search.placeholder"),
          value: values.q,
        },
    category:
      settings.show_category && categories.length > 0
        ? {
            name: DATED_PARAMS.category,
            label: t("search.form_category"),
            anyLabel: t("search.form_any"),
            options: categories,
            value: listed(categories, values.dated.category),
            style: settings.category_style,
          }
        : null,
    where,
    dates: source.booking && settings.show_dates ? datesOf(source, values.dated, t) : null,
    people: source.booking && settings.show_people ? peopleOf(values.dated, t) : null,
  }
}
