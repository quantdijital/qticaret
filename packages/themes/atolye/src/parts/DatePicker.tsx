"use client"

import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useEffect, useId, useState } from "react"
import type { KeyboardEvent, RefObject } from "react"
import type { SearchFormCalendarView, SearchFormDatesView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { LayerPortal } from "../frame/Layers"
import { DatePickerMonth } from "./DatePickerMonth"
import { addMonths, applied, canPick, monthOf, pickDay, toggleMonth } from "./date-picker-days"
import type { Bounds, DatesChoice, DayRange, PickerMode } from "./date-picker-days"
import {
  MONTH_DELAY_MS,
  calendarAddress,
  keptMonth,
  loadMonth,
  narrowingOf,
} from "./date-picker-load"
import type { MonthDays } from "./date-picker-load"

/** The last answer and the address it is for; `days` null: it failed. */
type Answer = { address: string; days: MonthDays | null } | null

const TAB =
  "flex-1 rounded-tile px-3 py-2 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-focus"
const ICON = "gf-icon-btn bg-paper-2 disabled:cursor-not-allowed disabled:opacity-40"

/**
 * The search box's calendar (adr/0077 §6): a modal dialog, a sheet from
 * the bottom on a phone, centred from 768 px. "Kesin tarih" picks a range
 * of up to `maxDays` days on a month with each day's lowest price (asked
 * from the storefront for the month shown, the form's category and party
 * with it); "Esnek: ay" up to `maxMonths` of the months a search reads.
 * Nothing is written until Apply; Escape, the scrim and the close button
 * leave the fields as they were, the focus back where it was. Prices are
 * only shown: the form sends days and months, never a price.
 */
export function DatePicker({
  mode: firstMode,
  dates,
  calendar,
  choice,
  form,
  onApply,
  onClose,
  opener,
}: {
  mode: PickerMode
  dates: SearchFormDatesView
  calendar: SearchFormCalendarView
  choice: DatesChoice
  form: () => HTMLFormElement | null
  onApply: (choice: DatesChoice) => void
  onClose: () => void
  opener: RefObject<HTMLElement | null>
}) {
  const { words } = calendar
  const id = useId()
  const bounds: Bounds = { min: dates.from.min, max: dates.from.max, maxDays: calendar.maxDays }
  const [mode, setMode] = useState(firstMode)
  const [range, setRange] = useState<DayRange>({ from: choice.from, to: choice.to })
  const [months, setMonths] = useState(choice.months)
  const [focus, setFocus] = useState(() =>
    choice.from && choice.from >= bounds.min ? choice.from : bounds.min
  )
  const [moved, setMoved] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [narrowing] = useState(() => narrowingOf(form()))
  const [answer, setAnswer] = useState<Answer>(null)
  const month = monthOf(focus)
  const address = calendarAddress(calendar.url, month, narrowing)
  // A kept month (or a held failure) at once; else still asked until the answer is the shown month's
  const known = keptMonth(address)
  const days = known !== undefined ? known : answer?.address === address ? answer.days : undefined
  const monthLabel = (value: string) =>
    dates.month.options.find((option) => option.value === value)?.label ?? value

  useEffect(() => {
    if (mode !== "exact" || keptMonth(address) !== undefined) {
      return
    }
    const request = new AbortController()
    // Paging through the months asks only for the one the shopper stops on (#310 D2)
    const timer = setTimeout(() => {
      loadMonth(address, request.signal).then(
        (found) => {
          setAnswer({ address, days: found })
        },
        () => {
          if (!request.signal.aborted) {
            setAnswer({ address, days: null })
          }
        }
      )
    }, MONTH_DELAY_MS)
    return () => {
      clearTimeout(timer)
      request.abort()
    }
  }, [address, mode])

  const toMonth = (count: number) => {
    const first = `${addMonths(month, count)}-01`
    setFocus(first < bounds.min ? bounds.min : first)
    setMoved(false)
  }
  const pick = (day: string) => {
    if (!canPick(range, day, bounds)) {
      // Only a day too far from the start says why; one out of the bounds is plainly off
      setNote(day >= bounds.min && day <= bounds.max ? words.rangeLimit : null)
      return
    }
    const next = pickDay(range, day, bounds)
    setRange(next)
    setNote(next.from && !next.to ? words.pickEnd : null)
  }
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault()
      const next = mode === "exact" ? "flexible" : "exact"
      setMode(next)
      setNote(null)
      document.getElementById(`${id}-${next}`)?.focus()
    }
  }
  const status =
    mode === "flexible"
      ? note
      : (note ??
        (days === undefined
          ? words.loading
          : days === null
            ? words.failed
            : range.from
              ? null
              : words.pickStart))

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <LayerPortal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-scrim" />
        <Dialog.Content
          data-date-picker=""
          aria-modal="true"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            const target = event.currentTarget as HTMLElement
            target.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (opener.current?.isConnected) {
              opener.current.focus()
            }
          }}
          className="fixed inset-x-0 bottom-0 z-(--z-modal) flex h-[92dvh] flex-col rounded-t-tile bg-paper text-text shadow-float outline-none md:inset-0 md:m-auto md:h-fit md:max-h-[calc(100dvh-2rem)] md:w-[calc(100%-2rem)] md:max-w-md md:rounded-tile"
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-4 pr-2 pl-4 sm:pl-6">
            <Dialog.Title className="max-w-none text-title">{words.title}</Dialog.Title>
            <Dialog.Close className="gf-icon-btn bg-paper-2" aria-label={words.close}>
              <X className="size-5" aria-hidden="true" strokeWidth={1.75} />
            </Dialog.Close>
          </div>
          <div role="tablist" className="mx-4 flex gap-1 rounded-tile bg-paper-2 p-1 sm:mx-6">
            {(["exact", "flexible"] as const).map((each) => (
              <button
                key={each}
                id={`${id}-${each}`}
                type="button"
                role="tab"
                aria-selected={mode === each}
                aria-controls={`${id}-panel`}
                tabIndex={mode === each ? 0 : -1}
                onClick={() => {
                  setMode(each)
                  setNote(null)
                }}
                onKeyDown={onTabKey}
                className={cn(TAB, mode === each ? "bg-paper text-text" : "text-text-2")}
              >
                {words[each]}
              </button>
            ))}
          </div>
          <div
            id={`${id}-panel`}
            role="tabpanel"
            aria-labelledby={`${id}-${mode}`}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
          >
            {mode === "exact" ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className={ICON}
                    aria-label={words.previous}
                    disabled={month <= monthOf(bounds.min)}
                    onClick={() => {
                      toMonth(-1)
                    }}
                  >
                    <ChevronLeft className="size-5" aria-hidden="true" strokeWidth={1.75} />
                  </button>
                  <p aria-live="polite" className="text-sm font-semibold">
                    {monthLabel(month)}
                  </p>
                  <button
                    type="button"
                    className={ICON}
                    aria-label={words.next}
                    disabled={month >= monthOf(bounds.max)}
                    onClick={() => {
                      toMonth(1)
                    }}
                  >
                    <ChevronRight className="size-5" aria-hidden="true" strokeWidth={1.75} />
                  </button>
                </div>
                <DatePickerMonth
                  month={month}
                  monthLabel={monthLabel}
                  range={range}
                  bounds={bounds}
                  days={days ?? null}
                  focus={focus}
                  moved={moved}
                  words={words}
                  onFocus={(day, byKey) => {
                    setFocus(day)
                    setMoved(byKey)
                  }}
                  onPick={pick}
                />
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {dates.month.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={months.includes(option.value)}
                    onClick={() => {
                      const next = toggleMonth(months, option.value, calendar.maxMonths)
                      setMonths(next.months)
                      setNote(next.full ? words.monthLimit : null)
                    }}
                    className={cn(
                      "rounded-tile border px-3 py-3 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-focus",
                      months.includes(option.value)
                        ? "border-text bg-text text-paper"
                        : "border-rule text-text hover:bg-paper-2"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p aria-live="polite" className="min-h-5 px-4 text-sm text-text-2 sm:px-6">
            {status}
          </p>
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <button
              type="button"
              className="gf-btn gf-btn--quiet"
              onClick={() => {
                setRange({ from: "", to: "" })
                setMonths([])
                setNote(null)
              }}
            >
              {words.clear}
            </button>
            <button
              type="button"
              className="gf-btn"
              onClick={() => {
                onApply(applied(mode, range, months))
              }}
            >
              {words.apply}
            </button>
          </div>
        </Dialog.Content>
      </LayerPortal>
    </Dialog.Root>
  )
}
