"use client"

import { useState } from "react"
import type { PlaceOrderResult, Translate } from "@qticaret/ui"
import { useChallengeForm } from "./useChallengeForm"

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

const NEWSLETTER_ERRORS = [
  "newsletter.email_invalid",
  "newsletter.rate_limited",
  "errors.challenge_failed",
]

/** A newsletter box's words: its title and line as the shop wrote them, the rest the storefront's. */
export const newsletterWords = (t: Translate, title: string, text: string): NewsletterWords => ({
  title,
  text,
  privacyLink: t("newsletter.privacy_link"),
  email: t("newsletter.email"),
  submit: t("newsletter.submit"),
  sent: t("newsletter.sent"),
  errors: Object.fromEntries(NEWSLETTER_ERRORS.map((key) => [key, t(key)])),
  fallback: t("newsletter.failed"),
})

/**
 * The newsletter box on the footer's dark band (İYS double opt-in: the
 * address confirms by e-mail, the shop's consent line beneath). A 48 px
 * field with its label, and the quiet button beside it; the answer and
 * any error are said under it. `id` names its heading.
 */
export function NewsletterForm({
  action,
  privacyPath,
  words,
  id = "bulten",
}: {
  action: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  privacyPath: string | null
  words: NewsletterWords
  id?: string
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
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="max-w-none font-body text-title font-medium tracking-normal">
        {words.title}
      </h2>
      {sent ? (
        <p role="status" className="text-md">
          {words.sent}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <label htmlFor={`${id}-eposta`} className="text-sm font-medium">
            {words.email}
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-eposta`}
              type="email"
              name="email"
              required
              maxLength={254}
              autoComplete="email"
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-durum`}
              className="at-field at-field--band min-w-0 flex-1"
            />
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending || undefined}
              className="at-btn at-btn--band shrink-0"
            >
              {words.submit}
            </button>
          </div>
          <p id={`${id}-durum`} role="alert" className="min-h-[1lh] text-sm">
            {error ? (words.errors[error] ?? words.fallback) : null}
          </p>
          <p className="text-xs text-band-text-2">
            {words.text}{" "}
            {privacyPath && (
              <a href={privacyPath} className="at-inline-link text-band-text">
                {words.privacyLink}
              </a>
            )}
          </p>
        </form>
      )}
    </section>
  )
}
