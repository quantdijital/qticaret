"use client"

import { useState } from "react"
import type { PlaceOrderResult } from "@qticaret/ui"
import { useChallengeForm } from "../account/useChallengeForm"

export interface NewsletterWords {
  title: string
  text: string
  privacyLink: string
  email: string
  submit: string
  sent: string
  errors: Record<string, string>
  fallback: string
}

/** The footer's newsletter box: the address confirms by e-mail (double opt-in). */
export function NewsletterForm({
  action,
  privacyPath,
  words,
}: {
  action: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  privacyPath: string | null
  words: NewsletterWords
}) {
  const [sent, setSent] = useState(false)
  const { error, pending, onSubmit } = useChallengeForm(async (state, form) => {
    const result = await action(state, form)
    if (result.ok) {
      setSent(true)
    }
    return result
  })
  return (
    <section aria-labelledby="bulten" className="flex flex-col gap-3">
      <h2 id="bulten" className="font-heading text-2xl">
        {words.title}
      </h2>
      {sent ? (
        <p role="status" className="text-sm text-ink-foreground">
          {words.sent}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex max-w-md gap-2">
            <input
              type="email"
              name="email"
              required
              maxLength={254}
              autoComplete="email"
              placeholder={words.email}
              aria-label={words.email}
              className="h-11 min-w-0 flex-1 rounded-full border border-ink-foreground/25 bg-transparent px-4 text-sm text-ink-foreground placeholder:text-ink-muted"
            />
            <button
              type="submit"
              disabled={pending}
              className="h-11 shrink-0 rounded-full bg-ink-foreground px-5 text-sm font-semibold text-ink disabled:opacity-50"
            >
              {words.submit}
            </button>
          </div>
          <p className="max-w-md text-xs text-ink-muted">
            {words.text}{" "}
            {privacyPath && (
              <a href={privacyPath} className="underline underline-offset-4">
                {words.privacyLink}
              </a>
            )}
          </p>
          <p role="alert" className="text-xs text-sale empty:hidden">
            {error ? (words.errors[error] ?? words.fallback) : null}
          </p>
        </form>
      )}
    </section>
  )
}
