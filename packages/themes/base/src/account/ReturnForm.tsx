"use client"

import { useActionState, useState } from "react"
import type { OrderActions, OrderPageView } from "@qticaret/ui"

export interface ReturnWords {
  title: string
  quantity: string
  reason: string
  note: string
  kindReturn: string
  kindExchange: string
  submit: string
  sending: string
  sent: string
  /** Under a line made to the buyer's wish (adr/0052 §8): no withdrawal, faulty or wrong only. */
  nonWithdrawable: string
  errors: Record<string, string>
  fallback: string
}

const FIELD = "rounded-lg border border-input bg-background px-3 py-2 text-sm"

/**
 * Asks to send lines back (F7.9): a quantity per line, a reason, a note.
 * A line made to the buyer's wish (adr/0052 §8) says it has no right of
 * withdrawal; once one of its units is chosen, only the reasons that are
 * the shop's fault are offered and no exchange. The backend decides again.
 */
export function ReturnForm({
  view,
  action,
  words,
}: {
  view: OrderPageView
  action: OrderActions["requestReturn"]
  words: ReturnWords
}) {
  const [state, submit, pending] = useActionState(action, { ok: false, error: null })
  // The non-withdrawable lines with a unit chosen, the kind and the reason as picked
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set())
  const [kind, setKind] = useState("return")
  const [reason, setReason] = useState("")
  const defectOnly = excluded.size > 0
  const defects = new Set(view.defectReasons ?? [])
  const reasons = defectOnly
    ? view.returnReasons.filter((each) => defects.has(each.value))
    : view.returnReasons
  const chosenReason = reasons.some((each) => each.value === reason) ? reason : ""
  const chosenKind = defectOnly ? "return" : kind
  if (state.ok) {
    return (
      <p role="status" className="text-sm text-success">
        {words.sent}
      </p>
    )
  }
  return (
    <form action={submit} className="flex flex-col gap-3 text-sm">
      <input type="hidden" name="order_id" value={view.orderId} />
      <input type="hidden" name="token" value={view.token ?? ""} />
      <ul className="flex flex-col gap-2">
        {(view.returnable ?? []).map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              {line.title}
              {line.nonWithdrawable && (
                <span className="text-xs text-muted-foreground">{words.nonWithdrawable}</span>
              )}
            </span>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">{words.quantity}</span>
              <select
                name={`qty_${line.id}`}
                defaultValue="0"
                onChange={(event) => {
                  if (line.nonWithdrawable) {
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
          </li>
        ))}
      </ul>
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
