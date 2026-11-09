"use client"

import { CircleCheck } from "lucide-react"
import { useState } from "react"
import type { OrderActions, OrderPageView, ReturnableLineView } from "@qticaret/ui"
import { useKeptForm } from "@qticaret/ui/hooks/use-kept-form"
import { ChoiceRow, FieldError, SelectField } from "../checkout/fields"

export interface ReturnWords {
  quantity: string
  reason: string
  note: string
  kindReturn: string
  kindExchange: string
  /** Over an exchanged line's variant choice ("Yerine"). */
  variant: string
  /** Under the kinds when an exchange is chosen: how a price difference is settled. */
  exchangeNote: string
  submit: string
  sending: string
  sent: string
  /** What sending the goods back costs, in words; null or left out on a form that sends nothing. */
  shipping?: string | null
  errors: Record<string, string>
  fallback: string
}

/** A line's small select beside its words: the native picker in the theme's pill. */
const SMALL = "gf-field w-auto min-w-20 py-2 pr-4 pl-4 text-md"

/**
 * Asks to send lines back (F7.9): a quantity per line, a reason, a note.
 * A line outside the right of withdrawal (adr/0052 §8) says so; once one of
 * its units is chosen, only the reasons that are the shop's fault are
 * offered and no exchange. A sealed good (adr/0032 Ek 2026-11-03) is chosen
 * like any other line, its warning under it. `gift`: gift card lines alone
 * (adr/0025), on the right of withdrawal and as money back only; a line
 * whose cards were spent says why and offers nothing. An exchange (adr/0032
 * §6) offers only the lines with another variant, each with its variant to
 * choose (`variant_<line id>`); never a price. Below the note, what
 * sending the goods back costs (`words.shipping`). The backend decides again.
 */
export function ReturnForm({
  view,
  lines,
  gift = false,
  action,
  words,
}: {
  view: OrderPageView
  lines: ReturnableLineView[]
  gift?: boolean
  action: OrderActions["requestReturn"]
  words: ReturnWords
}) {
  // Refused, the counts, the reason and the note stay as chosen
  const { state, pending, form } = useKeptForm(action)
  // The lines outside the right of withdrawal with a unit chosen, the kind and the reason as picked
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set())
  const [kind, setKind] = useState("return")
  const [reason, setReason] = useState("")
  const defectOnly = excluded.size > 0
  const defects = new Set(view.defectReasons ?? [])
  const offered = gift ? (view.giftReasons ?? []) : view.returnReasons
  const reasons = defectOnly ? offered.filter((each) => defects.has(each.value)) : offered
  const only = reasons.length === 1 ? (reasons[0]?.value ?? "") : ""
  const chosenReason = reasons.some((each) => each.value === reason) ? reason : only
  // A swap goes for another variant of the same product: only lines that have one
  const swappable = lines.some((line) => (line.variants ?? []).length > 0)
  const chosenKind = defectOnly || !swappable ? "return" : kind
  const shown =
    chosenKind === "exchange" ? lines.filter((line) => (line.variants ?? []).length > 0) : lines
  const id = gift ? "iade-hediye" : "iade"
  if (state.ok) {
    return (
      <p role="status" className="flex items-start gap-2 text-md font-semibold">
        <CircleCheck
          className="mt-0.5 size-5 shrink-0 text-ok"
          aria-hidden="true"
          strokeWidth={1.75}
        />
        {words.sent}
      </p>
    )
  }
  // Nothing to choose (a gift line whose cards were spent): only why
  if (lines.every((line) => line.quantity === 0)) {
    return (
      <ul className="flex flex-col gap-2 text-sm">
        {lines.map((line) => (
          <li key={line.id} className="flex flex-col gap-0.5 rounded-media bg-field p-4">
            <span className="font-semibold">{line.title}</span>
            {line.note && <span className="text-xs text-text-2">{line.note}</span>}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <form {...form} className="flex flex-col gap-4 text-sm">
      <input type="hidden" name="order_id" value={view.orderId} />
      <input type="hidden" name="token" value={view.token ?? ""} />
      <ul className="flex flex-col gap-2">
        {shown.map((line) => (
          <li
            key={line.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-media bg-field p-4"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold">{line.title}</span>
              {line.note && (
                <span
                  id={`note_${line.id}`}
                  className={
                    line.warning ? "text-xs font-semibold text-deal" : "text-xs text-text-2"
                  }
                >
                  {line.note}
                </span>
              )}
            </span>
            <span className="flex flex-wrap items-center gap-3">
              {chosenKind === "exchange" && line.quantity > 0 && (
                <label className="flex items-center gap-2">
                  <span className="text-text-2">{words.variant}</span>
                  <select name={`variant_${line.id}`} defaultValue="" className={SMALL}>
                    <option value="" disabled>
                      —
                    </option>
                    {(line.variants ?? []).map((variant) => (
                      <option key={variant.value} value={variant.value}>
                        {variant.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {line.quantity > 0 && (
                <label className="flex items-center gap-2">
                  <span className="text-text-2">{words.quantity}</span>
                  <select
                    name={`qty_${line.id}`}
                    defaultValue="0"
                    aria-describedby={line.note ? `note_${line.id}` : undefined}
                    onChange={(event) => {
                      // A gift line offers the right of withdrawal alone, whatever its mark
                      if (line.excluded && !gift) {
                        const next = new Set(excluded)
                        if (event.target.value === "0") {
                          next.delete(line.id)
                        } else {
                          next.add(line.id)
                        }
                        setExcluded(next)
                      }
                    }}
                    className={SMALL}
                  >
                    {Array.from({ length: line.quantity + 1 }, (_, index) => (
                      <option key={index} value={index}>
                        {index}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </span>
          </li>
        ))}
      </ul>
      {gift ? (
        <input type="hidden" name="kind" value="return" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <ChoiceRow
            name="kind"
            value="return"
            checked={chosenKind === "return"}
            onChange={() => {
              setKind("return")
            }}
          >
            <span className="font-semibold">{words.kindReturn}</span>
          </ChoiceRow>
          <div className="has-[:disabled]:opacity-55">
            <ChoiceRow
              name="kind"
              value="exchange"
              disabled={defectOnly || !swappable}
              checked={chosenKind === "exchange"}
              onChange={() => {
                setKind("exchange")
              }}
            >
              <span className="font-semibold">{words.kindExchange}</span>
            </ChoiceRow>
          </div>
        </div>
      )}
      {chosenKind === "exchange" && <p className="text-text-2">{words.exchangeNote}</p>}
      <SelectField
        id={`${id}-neden`}
        name="reason"
        label={words.reason}
        required
        value={chosenReason}
        onChange={(event) => {
          setReason(event.target.value)
        }}
      >
        <option value="" disabled>
          —
        </option>
        {reasons.map((each) => (
          <option key={each.value} value={each.value}>
            {each.label}
          </option>
        ))}
      </SelectField>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-aciklama`} className="text-sm font-semibold">
          {words.note}
        </label>
        <textarea
          id={`${id}-aciklama`}
          name="note"
          maxLength={1000}
          rows={3}
          className="gf-field min-h-24 rounded-inner"
        />
      </div>
      {words.shipping && <p className="text-text-2">{words.shipping}</p>}
      <div role="alert">
        <FieldError
          id={`${id}-hata`}
          message={state.error ? (words.errors[state.error] ?? words.fallback) : null}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="gf-btn self-start"
      >
        {pending ? words.sending : words.submit}
      </button>
    </form>
  )
}
