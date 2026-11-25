import type { ReactNode } from "react"
import type { DayRange } from "./day-range-filter"

/** One choice of a filter; `group` heads a run of choices, `depth` indents one (a tree). */
export interface FilterOption {
  value: string
  label: string
  group?: string | undefined
  depth?: number | undefined
}

interface FilterBase {
  /** The filter's own name, as the page's address holds it (`payment`). */
  key: string
  /** Its name on the menu and on its chip ("Ödeme"). */
  label: string
  /** A line under the choices (what the days are of). */
  hint?: string | undefined
}

/** One choice of a list (a payment state); the chip names it. */
export interface SingleFilter extends FilterBase {
  kind: "single"
  options: FilterOption[]
  /** The chip's word for a value the options do not hold (yet): a record still loading. */
  format?: ((value: string) => string) | undefined
}

/** Several choices of a list at once (an order paid or refunded). */
export interface MultiFilter extends FilterBase {
  kind: "multi"
  options: FilterOption[]
  format?: ((value: string) => string) | undefined
}

/** A number typed in the menu (days waiting). */
export interface NumberFilter extends FilterBase {
  kind: "number"
  min?: number | undefined
  max?: number | undefined
  suffix?: string | undefined
  /** The chip's words for the number ("3 günden fazla"). */
  format?: ((value: number) => string) | undefined
}

/** Days, either end open (`from`/`to`, Turkish `YYYY-MM-DD`). */
export interface DaysFilter extends FilterBase {
  kind: "days"
}

/** A control of the page's own in the menu (a brand searched on the server). */
export interface CustomFilter extends FilterBase {
  kind: "custom"
  /** The control; `close` closes the menu once a choice is made. */
  render: (close: () => void) => ReactNode
  /** The chip's words for the current value; nothing when the filter is not set. */
  summary: string | undefined
}

export type FilterDef = SingleFilter | MultiFilter | NumberFilter | DaysFilter | CustomFilter

/** A filter's value: a choice, choices, a number or days; nothing when it is not set. */
export type FilterValue = string | readonly string[] | number | DayRange | undefined

export type FilterValues = Readonly<Record<string, FilterValue>>

/** Whether a filter narrows the list. */
export function isActive(filter: FilterDef, value: FilterValue): boolean {
  switch (filter.kind) {
    case "custom":
      return filter.summary !== undefined
    case "multi":
      return Array.isArray(value) && value.length > 0
    case "number":
      return typeof value === "number"
    case "days": {
      const days = value as DayRange | undefined
      return Boolean(days?.from ?? days?.to)
    }
    case "single":
      return typeof value === "string" && value !== ""
  }
}

const labelOf = (filter: SingleFilter | MultiFilter, value: string): string =>
  filter.options.find((option) => option.value === value)?.label ?? filter.format?.(value) ?? value

/**
 * A set filter's value in words, for its chip and its row on the menu:
 * "Ödendi", "Ödendi, İade edildi", "3 günden fazla", "1 Kas – …".
 */
export function summaryOf(
  filter: FilterDef,
  value: FilterValue,
  days: (range: DayRange) => string
): string | undefined {
  if (!isActive(filter, value)) {
    return undefined
  }
  switch (filter.kind) {
    case "custom":
      return filter.summary
    case "multi":
      return (value as readonly string[]).map((one) => labelOf(filter, one)).join(", ")
    case "number": {
      const number = value as number
      return filter.format?.(number) ?? number.toString()
    }
    case "days":
      return days(value as DayRange)
    case "single":
      return labelOf(filter, value as string)
  }
}
