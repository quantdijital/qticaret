"use client"

import { BellRing, CircleAlert } from "lucide-react"
import { useState } from "react"
import type { PlaceOrderResult } from "@qticaret/ui"
import { useChallengeForm } from "../frame/useChallengeForm"
import type { AlertWords } from "./words"

/**
 * "Tell me when it is back" for a variant out of stock (F10.5), on a
 * filled well under the buy form: a signed-in customer presses one
 * button, a guest gives an address (double opt-in). The proof of work,
 * when asked, is solved in the browser.
 */
export function StockAlert({
  id,
  variantId,
  signedIn,
  action,
  words,
}: {
  /** The well's anchor: the phone's buy bar leads here for a variant out of stock. */
  id: string
  variantId: string
  signedIn: boolean
  action: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  words: AlertWords
}) {
  const [done, setDone] = useState(false)
  const { error, pending, checking, onSubmit } = useChallengeForm(async (state, form) => {
    const result = await action(state, form)
    if (result.ok) {
      setDone(true)
    }
    return result
  })
  if (done) {
    return (
      <p
        id={id}
        role="status"
        className="rounded-media bg-paper-2 p-4 text-sm font-semibold text-ok"
      >
        {signedIn ? words.sent : words.sentGuest}
      </p>
    )
  }
  const busy = pending || checking
  return (
    <form
      id={id}
      onSubmit={onSubmit}
      className="flex scroll-mt-40 flex-col gap-3 rounded-media bg-paper-2 p-4"
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <BellRing className="size-5" aria-hidden="true" strokeWidth={1.75} />
        {words.title}
      </p>
      <input type="hidden" name="variant_id" value={variantId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        {!signedIn && (
          <>
            <label htmlFor={`${id}-eposta`} className="sr-only">
              {words.email}
            </label>
            <input
              id={`${id}-eposta`}
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder={words.email}
              className="gf-field min-w-0 flex-1"
            />
          </>
        )}
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className="gf-btn gf-btn--quiet shrink-0"
        >
          {words.submit}
        </button>
      </div>
      <p role="alert" className="text-sm text-error empty:hidden">
        {error && (
          <span className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
            {words.errors[error] ?? words.fallback}
          </span>
        )}
      </p>
    </form>
  )
}
