"use client"

import { BellRing } from "lucide-react"
import { useState } from "react"
import type { PlaceOrderResult } from "@qticaret/ui"
import { useChallengeForm } from "../account/useChallengeForm"

export interface StockAlertWords {
  title: string
  email: string
  submit: string
  sent: string
  sentGuest: string
  errors: Record<string, string>
  fallback: string
}

/** "Tell me when it is back" for a variant out of stock (F10.5); a guest gives an address. */
export function StockAlertForm({
  variantId,
  signedIn,
  action,
  words,
}: {
  variantId: string
  signedIn: boolean
  action: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  words: StockAlertWords
}) {
  const [done, setDone] = useState(false)
  const { error, pending, onSubmit } = useChallengeForm(async (state, form) => {
    const result = await action(state, form)
    if (result.ok) {
      setDone(true)
    }
    return result
  })
  if (done) {
    return (
      <p role="status" className="rounded-xl border p-3 text-sm text-success">
        {signedIn ? words.sent : words.sentGuest}
      </p>
    )
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-xl border p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <BellRing className="size-4" aria-hidden="true" />
        {words.title}
      </p>
      <input type="hidden" name="variant_id" value={variantId} />
      <div className="flex gap-2">
        {!signedIn && (
          <input
            type="email"
            name="email"
            required
            placeholder={words.email}
            aria-label={words.email}
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
          />
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-10 shrink-0 rounded-button border border-foreground px-4 text-sm font-semibold disabled:opacity-50"
        >
          {words.submit}
        </button>
      </div>
      <p role="alert" className="text-xs text-sale empty:hidden">
        {error ? (words.errors[error] ?? words.fallback) : null}
      </p>
    </form>
  )
}
