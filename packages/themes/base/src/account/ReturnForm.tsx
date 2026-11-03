"use client"

import { useActionState, useState } from "react"
import type { OrderActions, OrderPageView, ReturnableLineView } from "@qticaret/ui"

export interface ReturnWords {
  quantity: string
  reason: string
  note: string
  kindReturn: string
  kindExchange: string
  submit: string
  sending: string
  sent: string
  errors: Record<string, string>
  fallback: string
}

const FIELD = "rounded-lg border border-input bg-background px-3 py-2 text-sm"

/**
 * Asks to send lines back (F7.9): a quantity per line, a reason, a note.
 * A line outside the right of withdrawal (adr/0052 §8) says so; once one of
 * its units is chosen, only the reasons that are the shop's fault are
 * offered and no exchange. `gift`: gift card lines alone (adr/0025), on the
 * right of withdrawal and as money back only; a line whose cards were spent
 * says why and offers nothing. The backend decides again.
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
  const [state, submit, pending] = useActionState(action, { ok: false, error: null })
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
  const chosenKind = defectOnly ? "return" : kind
  if (state.ok) {
    return (
      <p role="status" className="text-sm text-success">
        {words.sent}
      </p>
    )
  }
  // Nothing to choose (a gift line whose cards were spent): only why
  if (lines.every((line) => line.quantity === 0)) {
    return (
      <ul className="flex flex-col gap-2 text-sm">
        {lines.map((line) => (
          <li key={line.id} className="flex flex-col">
            {line.title}
            {line.note && <span className="text-xs text-muted-foreground">{line.note}</span>}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <form action={submit} className="flex flex-col gap-3 text-sm">
      <input type="hidden" name="order_id" value={view.orderId} />
      <input type="hidden" name="token" value={view.token ?? ""} />
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              {line.title}
              {line.note && <span className="text-xs text-muted-foreground">{line.note}</span>}
            </span>
            {line.quantity > 0 && (
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground">{words.quantity}</span>
                <select
                  name={`qty_${line.id}`}
                  defaultValue="0"
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
                  className={FIELD}
                >
                  {Array.from({ length: line.quantity + 1 }, (_, index) => (
                    <option key={index} value={index}>
                      {index}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </li>
        ))}
      </ul>
      {gift ? (
        <input type="hidden" name="kind" value="return" />
      ) : (
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="kind"
              value="return"
              checked={chosenKind === "return"}
              onChange={() => {
                setKind("return")
              }}
            />{" "}
            {words.kindReturn}
          </label>
          <label className="flex items-center gap-2 has-[:disabled]:opacity-50">
            <input
              type="radio"
              name="kind"
              value="exchange"
              disabled={defectOnly}
              checked={chosenKind === "exchange"}
              onChange={() => {
                setKind("exchange")
              }}
            />{" "}
            {words.kindExchange}
          </label>
        </div>
      )}
      <label className="flex flex-col gap-1">
        {words.reason}
        <select
          name="reason"
          required
          value={chosenReason}
          onChange={(event) => {
            setReason(event.target.value)
          }}
          className={FIELD}
        >
          <option value="" disabled>
            —
          </option>
          {reasons.map((each) => (
            <option key={each.value} value={each.value}>
              {each.label}
            </option>
          ))}
        </select>
      </label>
      <textarea name="note" maxLength={1000} rows={3} placeholder={words.note} className={FIELD} />
      <p role="alert" className="text-sale empty:hidden">
        {state.error ? (words.errors[state.error] ?? words.fallback) : null}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="h-10 self-start rounded-button bg-foreground px-5 font-semibold text-background disabled:opacity-50"
      >
        {pending ? words.sending : words.submit}
      </button>
    </form>
  )
}
