"use client"

import { useEffect, useRef } from "react"
import type { KeyboardEvent } from "react"
import type { SearchFormCalendarView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { canPick, dayPlace, fill, monthOf, monthWeeks, movedDay } from "./date-picker-days"
import type { Bounds, DayRange } from "./date-picker-days"
import type { MonthDays } from "./date-picker-load"

const DAY =
  "flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-tile text-sm tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-focus"

/**
 * One month of the calendar as a grid (WAI-ARIA date picker): Monday
 * first; each day a button whose name says the date, the lowest price and
 * how many departures; the price under the number, short on a phone. A
 * day without departures is pale but can still start or end a range; a
 * day the search cannot take (before today, after the last month, too far
 * from the start) cannot be pressed. One day takes the tab stop; the
 * arrows move it a day or a week (into the next month too), Page Up and
 * Page Down a month, Enter and Space press it.
 */
export function DatePickerMonth({
  month,
  monthLabel,
  range,
  bounds,
  days,
  focus,
  moved,
  words,
  onFocus,
  onPick,
}: {
  month: string
  monthLabel: (month: string) => string
  range: DayRange
  bounds: Bounds
  /** The month's departures; null while asked or when the answer failed. */
  days: MonthDays | null
  focus: string
  /** The focus moved by a key: the focused day takes the browser's focus. */
  moved: boolean
  words: SearchFormCalendarView["words"]
  onFocus: (day: string, byKey: boolean) => void
  onPick: (day: string) => void
}) {
  const grid = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (moved) {
      grid.current?.querySelector<HTMLElement>(`[data-day="${focus}"]`)?.focus()
    }
  }, [focus, moved])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = movedDay(focus, event.key, bounds)
    if (next === null) {
      return
    }
    event.preventDefault()
    onFocus(next, true)
  }

  const label = (day: string) => {
    const date = `${Number(day.slice(8, 10))} ${monthLabel(monthOf(day))}`
    const found = days?.get(day)
    if (!found) {
      return fill(words.dayEmpty, { date })
    }
    if (found.price && found.before && words.dayPricedBefore) {
      const values = { date, price: found.price, before: found.before, count: found.departures }
      return fill(words.dayPricedBefore, values)
    }
    return found.price
      ? fill(words.dayPriced, { date, price: found.price, count: found.departures })
      : fill(words.dayCounted, { date, count: found.departures })
  }

  return (
    <div ref={grid} role="grid" aria-label={monthLabel(month)} onKeyDown={onKeyDown}>
      <div role="row" className="grid grid-cols-7 pb-1">
        {words.weekdays.map((weekday) => (
          <span
            key={weekday}
            role="columnheader"
            className="text-center text-xs font-semibold text-text-3"
          >
            {weekday}
          </span>
        ))}
      </div>
      {monthWeeks(month).map((week) => (
        <div key={week.find(Boolean) ?? ""} role="row" className="grid grid-cols-7 gap-y-1">
          {week.map((day, index) => {
            if (day === null) {
              return <span key={`-${String(index)}`} role="gridcell" />
            }
            const place = dayPlace(range, day)
            const found = days?.get(day)
            const can = canPick(range, day, bounds)
            const ends = place === "start" || place === "end"
            return (
              <span key={day} role="gridcell">
                <button
                  type="button"
                  data-day={day}
                  tabIndex={day === focus ? 0 : -1}
                  aria-label={label(day)}
                  aria-pressed={place !== null}
                  aria-disabled={can ? undefined : true}
                  onClick={() => {
                    onFocus(day, false)
                    onPick(day)
                  }}
                  className={cn(
                    DAY,
                    ends
                      ? "bg-text text-paper"
                      : place === "inside"
                        ? "bg-paper-2 text-text"
                        : found
                          ? "text-text hover:bg-paper-2"
                          : "text-text-3 hover:bg-paper-2",
                    !can && "cursor-not-allowed opacity-40 hover:bg-transparent"
                  )}
                >
                  <span className={found ? "font-semibold" : undefined}>
                    {Number(day.slice(8, 10))}
                  </span>
                  {found?.short && (
                    <span
                      aria-hidden="true"
                      // Too narrow to strike the price before through: the sale's colour says it
                      className={cn(
                        "text-[0.6875rem] leading-none",
                        !ends && (found.before ? "text-deal" : "text-text-2")
                      )}
                    >
                      <span className="md:hidden">{found.short}</span>
                      <span className="max-md:hidden">{found.whole}</span>
                    </span>
                  )}
                </button>
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
