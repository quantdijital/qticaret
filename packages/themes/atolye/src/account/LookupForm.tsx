"use client"

import type { AuthAction } from "@qticaret/ui"
import { FieldError, TextField } from "../checkout/fields"
import { useChallengeForm } from "../frame/useChallengeForm"

export interface LookupWords {
  orderNumber: string
  orderHint: string
  email: string
  submit: string
  working: string
  checking: string
  errors: Record<string, string>
  fallback: string
}

/**
 * The order number and the e-mail it was placed with; the storefront's
 * action sends the order's link to that address when they match (adr/0037
 * §2), never saying whether they did. A proof of work the backend asks
 * for is solved here and the form sent again.
 */
export function LookupForm({ action, words }: { action: AuthAction; words: LookupWords }) {
  const { error, checking, pending, onSubmit } = useChallengeForm(action)
  const message = error ? (words.errors[error] ?? words.fallback) : null
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <TextField
        id="display_id"
        name="display_id"
        label={words.orderNumber}
        hint={words.orderHint}
        inputMode="numeric"
        autoComplete="off"
        required
        pattern="#?[0-9]{1,10}"
      />
      <TextField
        id="email"
        name="email"
        type="email"
        label={words.email}
        autoComplete="email"
        inputMode="email"
        required
        maxLength={254}
      />
      <div role="alert">
        <FieldError id="siparis-bul-hata" message={message} />
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="gf-btn w-full sm:w-auto sm:self-start"
      >
        {pending ? (checking ? words.checking : words.working) : words.submit}
      </button>
    </form>
  )
}
