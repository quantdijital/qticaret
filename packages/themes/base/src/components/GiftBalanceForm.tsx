"use client"

import { useState } from "react"
import type { GiftBalanceResult } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { useChallengeForm } from "../account/useChallengeForm"
import { TextField } from "../checkout/fields"

export interface GiftBalanceWords {
  code: string
  submit: string
  working: string
  checking: string
  errors: Record<string, string>
  fallback: string
}

/**
 * The code, sent in the body (`method="post"`: never in an address a log
 * keeps); past a few tries the backend asks for a proof of work, which
 * the browser solves before sending again (adr/0044).
 */
export function GiftBalanceForm({
  action,
  words,
}: {
  action: (state: GiftBalanceResult, form: FormData) => Promise<GiftBalanceResult>
  words: GiftBalanceWords
}) {
  const [balance, setBalance] = useState<string | null>(null)
  const { error, checking, pending, onSubmit } = useChallengeForm(async (state, form) => {
    setBalance(null)
    const result = await action({ ...state, balance: null }, form)
    if (result.ok) {
      setBalance(result.balance)
    }
    return result
  })
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
      />
      <Button type="submit" disabled={pending} className="h-12 rounded-button text-base">
        {checking ? words.checking : pending ? words.working : words.submit}
      </Button>
      <p role="status" aria-live="polite" className="min-h-6 text-sm">
        {balance !== null && <span className="font-semibold text-success">{balance}</span>}
        {error && <span className="text-sale">{words.errors[error] ?? words.fallback}</span>}
      </p>
    </form>
  )
}
