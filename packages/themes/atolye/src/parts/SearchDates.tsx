"use client"

import { CalendarDays, CalendarRange } from "lucide-react"
import { useRef, useState, useSyncExternalStore } from "react"
import type { KeyboardEvent } from "react"
import type { SearchFormDatesView, SearchFormDayView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { DatePicker } from "./DatePicker"
import type { DatesChoice, PickerMode } from "./date-picker-days"
import { CONTROL, Cell, DAY, DayCell, SelectCell } from "./search-form-cells"

// On a phone its fields join the form's grid rows; from 768 px one part of the bar.
// From 1024 px never narrower than its three fields' own widths (`DAY`): squeezed
// below them, the flexible month ran over the people field beside it
const GROUP =
  "flex min-w-0 max-md:contents md:flex-[2.4] md:flex-row md:border-l md:border-rule lg:flex-[3] lg:min-w-fit"

// False on the server and while hydrating, true after: the page as sent is the plain form's
const never = () => () => undefined
const inBrowser = () => true
const onServer = () => false

/** Keys that open the calendar from a field, as a drop-down opens. */
const OPENING = new Set(["Enter", " ", "ArrowDown"])

/**
 * The search box's dates (adr/0077 §1, §6). As sent, and without
 * JavaScript, two day fields and a month drop-down. Once the page runs,
 * and while the view carries a calendar, the same fields open the
 * calendar instead of the browser's own picker: the day fields read-only
 * (the calendar writes them), the month a button with the chosen months
 * (up to three) in a hidden field of the same name. Closed, the calendar
 * draws nothing; its days are asked for only once it opens.
 */
export function SearchDates({
  dates,
  wide,
}: {
  dates: SearchFormDatesView
  /** The first day field across the phone's grid (an odd count of fields). */
  wide?: string | false | undefined
}) {
  const running = useSyncExternalStore(never, inBrowser, onServer)
  const [choice, setChoice] = useState<DatesChoice>(() => ({
    from: dates.from.value,
    to: dates.to.value,
    months: dates.month.value ? [dates.month.value] : [],
  }))
  const [mode, setMode] = useState<PickerMode | null>(null)
  const group = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const calendar = dates.calendar

  if (!running || !calendar) {
    return (
      <div role="group" aria-label={dates.label} className={GROUP}>
        <DayCell field={dates.from} className={wide} />
        <DayCell field={dates.to} />
        <SelectCell icon={CalendarRange} field={dates.month} className={DAY} />
      </div>
    )
  }

  function show(next: PickerMode, from: HTMLElement) {
    opener.current = from
    setMode(next)
  }
  function onDayKey(event: KeyboardEvent<HTMLElement>) {
    if (OPENING.has(event.key)) {
      event.preventDefault()
      show("exact", event.currentTarget)
    }
  }
  const day = (field: SearchFormDayView, value: string, className?: string | false) => (
    <Cell icon={CalendarDays} label={field.label} className={cn(DAY, className)}>
      <input
        key="calendar"
        type="date"
        name={field.name}
        value={value}
        min={field.min}
        max={field.max}
        readOnly
        aria-haspopup="dialog"
        onClick={(event) => {
          show("exact", event.currentTarget)
        }}
        onKeyDown={onDayKey}
        className={cn(CONTROL, "cursor-pointer")}
      />
    </Cell>
  )
  const monthWords = choice.months
    .map((month) => dates.month.options.find((option) => option.value === month)?.label ?? month)
    .join(", ")

  return (
    <div ref={group} role="group" aria-label={dates.label} className={GROUP}>
      {day(dates.from, choice.from, wide)}
      {day(dates.to, choice.to)}
      <Cell icon={CalendarRange} label={dates.month.label} className={DAY}>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => {
            show("flexible", event.currentTarget)
          }}
          className={cn(CONTROL, "cursor-pointer text-left")}
        >
          {monthWords || dates.month.anyLabel}
        </button>
        {choice.months.length > 0 && (
          <input type="hidden" name={dates.month.name} value={choice.months.join(",")} />
        )}
      </Cell>
      {mode && (
        <DatePicker
          mode={mode}
          dates={dates}
          calendar={calendar}
          choice={choice}
          form={() => group.current?.closest("form") ?? null}
          onApply={(next) => {
            setChoice(next)
            setMode(null)
          }}
          onClose={() => {
            setMode(null)
          }}
          opener={opener}
        />
      )}
    </div>
  )
}
