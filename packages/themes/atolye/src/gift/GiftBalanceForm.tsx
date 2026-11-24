"use client"

import { useState } from "react"
import type { GiftBalanceResult } from "@qticaret/ui"
import { FieldError, TextField } from "../checkout/fields"
import { useChallengeForm } from "../frame/useChallengeForm"

export interface GiftBalanceWords {
  code: string
  /** The example inside the field. */
  placeholder: string
  submit: string
  working: string
  checking: string
  errors: Record<string, string>
  fallback: string
}

/**
 * The code, sent in the body (`method="post"`: never in an address a log
 * keeps); past a few tries the backend asks for a proof of work, which
 * the browser solves before sending again (adr/0044). The balance comes
 * back under the button in green; a refusal in the error's colour.
 */
export function GiftBalanceForm({
  action,
  words,
}: {
  action: (state: GiftBalanceResult, form: FormData) => Promise<GiftBalanceResult>
  words: GiftBalanceWords
}) {
  const [balance, setBalance] = useState<string | null>(null)
  const { error, checking, pending, onSubmit, slot } = useChallengeForm(
    async (state, form) => {
      setBalance(null)
      const result = await action({ ...state, balance: null }, form)
      if (result.ok) {
        setBalance(result.balance)
      }
      return result
    },
    { action: "gift_card" }
  )
  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField
        id="hediye-karti-kodu"
        name="code"
        required
        minLength={4}
        maxLength={64}
        autoComplete="off"
        spellCheck={false}
        label={words.code}
        placeholder={words.placeholder}
      />
      {slot}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="gf-btn w-full sm:w-auto sm:self-start"
      >
        {checking ? words.checking : pending ? words.working : words.submit}
      </button>
      <div role="status" aria-live="polite" className="min-h-6">
        {balance !== null && <p className="tabular text-lg font-extrabold text-ok">{balance}</p>}
        <FieldError
          id="hediye-karti-kodu-sonuc"
          message={error ? (words.errors[error] ?? words.fallback) : null}
        />
      </div>
    </form>
  )
}
