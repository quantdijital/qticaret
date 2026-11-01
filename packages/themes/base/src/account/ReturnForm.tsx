"use client"

import { useActionState } from "react"
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
  errors: Record<string, string>
  fallback: string
}

const FIELD = "rounded-lg border border-input bg-background px-3 py-2 text-sm"

/** Asks to send lines back (F7.9): a quantity per line, a reason, a note. */
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
            <span>{line.title}</span>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">{words.quantity}</span>
              <select name={`qty_${line.id}`} defaultValue="0" className={FIELD}>
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
          <input type="radio" name="kind" value="return" defaultChecked /> {words.kindReturn}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" value="exchange" /> {words.kindExchange}
        </label>
      </div>
      <label className="flex flex-col gap-1">
        {words.reason}
        <select name="reason" required defaultValue="" className={FIELD}>
          <option value="" disabled>
            —
          </option>
          {view.returnReasons.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
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
        className="h-10 self-start rounded-full bg-foreground px-5 font-semibold text-background disabled:opacity-50"
      >
        {pending ? words.sending : words.submit}
      </button>
    </form>
  )
}
