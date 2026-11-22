"use client"

import { Minus, Plus } from "lucide-react"
import { useState } from "react"
import type { BookingCategoryView, BookingDepartureView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { isBookable } from "./booking-picks"
import type { BookingWords } from "./booking-words"

/** Departures shown before "all dates": a phone's screen of them. */
export const DEPARTURES_SHOWN = 6

const DEPARTURE =
  "flex min-h-14 cursor-pointer flex-col justify-center gap-0.5 rounded-inner gf-pill px-4 py-2 text-sm transition-colors duration-(--dur-micro) has-[:checked]:font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-not-allowed has-[:disabled]:text-text-3"

const STEP =
  "flex size-11 shrink-0 items-center justify-center rounded-button bg-paper-2 text-text transition-colors duration-(--dur-micro) hover:bg-paper-3 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"

/** A departure's state in words: closed, full, the last few places, or how many. */
export function departureState(
  departure: BookingDepartureView,
  fewLeft: number,
  words: BookingWords
): { text: string; tone: "off" | "few" | "plain" } {
  if (departure.status === "closed") {
    return { text: words.closed, tone: "off" }
  }
  if (departure.prices.length === 0) {
    return { text: words.noPrice, tone: "off" }
  }
  if (departure.available <= 0) {
    return { text: words.full, tone: "off" }
  }
  const count = String(departure.available)
  return departure.available <= fewLeft
    ? { text: words.fewLeft.replace("{count}", count), tone: "few" }
    : { text: words.placesLeft.replace("{count}", count), tone: "plain" }
}

/**
 * The departures as one radio group (`slot_id`), soonest first: each its
 * date and time in the product's zone and its places; one closed or full
 * is there but cannot be picked, its reason written. The first few show;
 * the rest open with "all dates" (the radios stay in the form either way).
 */
export function Departures({
  departures,
  chosen,
  choose,
  fewLeft,
  words,
}: {
  departures: BookingDepartureView[]
  chosen: string | null
  choose: (id: string) => void
  fewLeft: number
  words: BookingWords
}) {
  const [all, setAll] = useState(false)
  const chosenAt = departures.findIndex((departure) => departure.id === chosen)
  const shown = all ? departures.length : Math.max(DEPARTURES_SHOWN, chosenAt + 1)
  return (
    <fieldset className="flex flex-col gap-3">
      <legend id="rezervasyon-tarihleri" className="mb-3 text-sm font-semibold">
        {words.departures}
      </legend>
      <div
        role="radiogroup"
        aria-labelledby="rezervasyon-tarihleri"
        className="grid grid-cols-1 gap-2 @min-[24rem]:grid-cols-2"
      >
        {departures.map((departure, index) => {
          const state = departureState(departure, fewLeft, words)
          const id = `kalkis-${departure.id}`
          return (
            <label
              key={departure.id}
              htmlFor={id}
              className={cn(DEPARTURE, index >= shown && "hidden")}
            >
              <input
                id={id}
                type="radio"
                name="slot_id"
                value={departure.id}
                checked={chosen === departure.id}
                disabled={!isBookable(departure)}
                onChange={() => {
                  choose(departure.id)
                }}
                className="sr-only"
              />
              <time dateTime={departure.startsAt}>{departure.label}</time>
              <span
                className={cn(
                  "text-xs",
                  state.tone === "few" ? "font-semibold text-error" : "text-text-2"
                )}
              >
                {state.text}
              </span>
            </label>
          )
        })}
      </div>
      {!all && departures.length > shown && (
        <button
          type="button"
          onClick={() => {
            setAll(true)
          }}
          className="gf-link self-start text-sm font-semibold"
        >
          {words.moreDepartures.replace("{count}", String(departures.length))}
        </button>
      )}
    </fieldset>
  )
}

/**
 * How many of each price category: a minus and plus either side of the
 * count (`qty_<variant>`), the category's price on the chosen departure,
 * its ages, and "takes no seat" for one that takes no place.
 */
export function Counts({
  categories,
  departure,
  counts,
  canAdd,
  change,
  words,
}: {
  categories: BookingCategoryView[]
  departure: BookingDepartureView | null
  counts: Record<string, number>
  canAdd: (category: BookingCategoryView) => boolean
  change: (variantId: string, next: number) => void
  words: BookingWords
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-semibold">{words.people}</legend>
      <ul className="flex flex-col gap-2">
        {categories.map((category) => {
          const count = counts[category.variantId] ?? 0
          const price = departure?.prices.find((each) => each.variantId === category.variantId)
          const label = words.countOf.replace("{title}", () => category.title)
          return (
            <li
              key={category.variantId}
              className="flex items-center justify-between gap-3 rounded-inner bg-field px-3 py-2"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{category.title}</span>
                <span className="text-xs text-text-2">
                  {[category.ages, category.pax === 0 ? words.noSeat : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="tabular text-sm">{price?.price ?? words.noPrice}</span>
              </div>
              <div role="group" aria-label={label} className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={words.decrease.replace("{title}", () => category.title)}
                  disabled={count <= 0}
                  onClick={() => {
                    change(category.variantId, count - 1)
                  }}
                  className={STEP}
                >
                  <Minus className="size-4" aria-hidden="true" strokeWidth={2.25} />
                </button>
                <output
                  aria-live="polite"
                  className="tabular w-8 text-center text-md font-semibold"
                >
                  {count}
                </output>
                <input type="hidden" name={`qty_${category.variantId}`} value={count} />
                <button
                  type="button"
                  aria-label={words.increase.replace("{title}", () => category.title)}
                  disabled={!canAdd(category)}
                  onClick={() => {
                    change(category.variantId, count + 1)
                  }}
                  className={STEP}
                >
                  <Plus className="size-4" aria-hidden="true" strokeWidth={2.25} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
