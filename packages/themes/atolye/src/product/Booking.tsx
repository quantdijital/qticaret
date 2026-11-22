"use client"

import { CalendarClock, Check, CircleAlert } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { formatLira } from "@qticaret/ui"
import type { BookingCategoryView, BookingView, FormAction } from "@qticaret/ui"
import { useKeptForm } from "@qticaret/ui/hooks/use-kept-form"
import { announceCartAdded, submitterOf } from "../frame/events"
import {
  type Counts,
  canAddOne,
  firstBookable,
  fitCounts,
  initialCounts,
  peopleOf,
  totalKurus,
} from "./booking-picks"
import type { BookingWords } from "./booking-words"
import { Counts as CountFields, Departures } from "./BookingParts"

const FORM = "rezervasyon-formu"

/**
 * A dated product's buy column (adr/0076 §10), in place of the options
 * and "add to cart": the departures as one radio group, how many of each
 * price category, the total those make (shown only: the server prices
 * the lines in the cart), then "Rezervasyon yap" in the shop's colour
 * with the favourite heart. Without departures: "new dates soon", the
 * page stays as it is. The form sends the departure and the counts only.
 * A product sold by "call me" request (adr/0076 Ek 2026-11-23) shows the
 * request form in place of all this (`request.mode` `request`), or under
 * it (`both`, a secondary button that opens it).
 */
export function Booking({
  productId,
  view,
  action,
  favorite,
  summary,
  whatsapp,
  words,
  request = null,
}: {
  productId: string
  view: BookingView
  action: FormAction
  favorite: ReactNode
  summary: ReactNode
  whatsapp: ReactNode
  words: BookingWords
  /** The call-me form, in place of the cart (`request`) or under it (`both`). */
  request?: { mode: "request" | "both"; form: ReactNode } | null
}) {
  const { state, pending, form } = useKeptForm(action)
  const [chosen, setChosen] = useState<string | null>(() => firstBookable(view))
  const departure = view.departures.find((each) => each.id === chosen) ?? null
  const [counts, setCounts] = useState<Counts>(() =>
    fitCounts(view, departure, initialCounts(view.categories))
  )
  const [stale, setStale] = useState(false)
  const origin = useRef<HTMLElement | null>(null)
  const sent = useRef(false)

  useEffect(() => {
    if (state.ok && sent.current) {
      announceCartAdded(words.added, origin.current)
      sent.current = false
    }
  }, [state, words.added])

  if (request?.mode === "request") {
    return (
      <div className="gf-buy-stack flex flex-col gap-6">
        {summary}
        {request.form}
        <div className="flex items-center gap-2">{favorite}</div>
        {whatsapp}
      </div>
    )
  }

  if (view.departures.length === 0) {
    return (
      <div className="gf-buy-stack flex flex-col gap-6">
        {summary}
        <div role="status" className="flex items-start gap-3 rounded-media gf-box p-4">
          <CalendarClock className="mt-0.5 size-5 shrink-0" aria-hidden="true" strokeWidth={2} />
          <div className="flex flex-col gap-1">
            <p className="text-md font-semibold">{words.soon}</p>
            <p className="text-sm text-text-2">{words.soonText}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">{favorite}</div>
        {request?.form}
        {whatsapp}
      </div>
    )
  }

  const choose = (id: string) => {
    const next = view.departures.find((each) => each.id === id) ?? null
    setChosen(id)
    setStale(true)
    setCounts((now) => fitCounts(view, next, now))
  }
  const change = (variantId: string, next: number) => {
    setStale(true)
    setCounts((now) => ({ ...now, [variantId]: Math.max(0, next) }))
  }
  const canAdd = (category: BookingCategoryView) => canAddOne(view, departure, category, counts)
  const people = peopleOf(counts)
  const total = totalKurus(departure, counts)
  const ready = departure !== null && people > 0 && !pending
  const error = !stale && state.error ? (words.errors[state.error] ?? words.fallback) : null
  return (
    <div className="gf-buy-stack flex flex-col gap-6">
      {summary}
      <form
        id={FORM}
        action={form.action}
        onSubmit={(event) => {
          setStale(false)
          origin.current = submitterOf(event)
          sent.current = true
          form.onSubmit(event)
        }}
        // Booked, the picks stay as they were: they say what went into the cart
        onReset={(event) => {
          event.preventDefault()
        }}
        className="flex scroll-mt-40 flex-col gap-6"
      >
        <input type="hidden" name="product_id" value={productId} />
        <Departures
          departures={view.departures}
          chosen={chosen}
          choose={choose}
          fewLeft={view.fewLeft}
          words={words}
        />
        <CountFields
          categories={view.categories}
          departure={departure}
          counts={counts}
          canAdd={canAdd}
          change={change}
          words={words}
        />
        <div className="flex flex-col gap-1">
          <p aria-live="polite" className="flex items-baseline justify-between text-sm">
            <span className="text-text-2">
              {words.total}
              {people > 0 && ` (${words.totalPeople.replace("{count}", String(people))})`}
            </span>
            <span className="tabular text-lg font-extrabold">
              {total === null ? "—" : formatLira(total / 100)}
            </span>
          </p>
          <p className="text-xs text-text-3">{words.totalNote}</p>
        </div>
      </form>
      <div className="flex flex-col gap-3">
        <div data-buy-row="" className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            form={FORM}
            disabled={!ready}
            aria-busy={pending}
            className="gf-btn min-w-0 flex-1"
          >
            {pending ? words.adding : words.submit}
          </button>
          {favorite}
        </div>
        <p role="status" aria-live="polite" className="text-sm empty:hidden">
          {!stale && state.ok && (
            <span className="flex flex-wrap items-center gap-x-2 font-semibold text-ok">
              <Check className="size-4" aria-hidden="true" strokeWidth={2.5} />
              {words.added}
              <a href="/sepet" className="gf-link min-h-0 text-text">
                {words.goToCart}
              </a>
            </span>
          )}
          {error && (
            <span className="flex items-start gap-2 text-error">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
              {error}
            </span>
          )}
        </p>
        {request?.form}
        {whatsapp}
      </div>
    </div>
  )
}
