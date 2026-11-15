"use client"

import { useState } from "react"
import { fieldMark } from "@qticaret/ui"
import type { PlaceOrderResult } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import type { NewsletterWords } from "./newsletter-words"
import { useChallengeForm } from "./useChallengeForm"

/**
 * The newsletter form (İYS: double opt-in, the address confirms by
 * e-mail): a 48 px pill field with its label and the button beside it,
 * then the consent box, unticked and required, its label the shop's own
 * sentence with the privacy notice's link. The answer and any error are
 * said under it. `id` keeps two forms on a page apart. `quiet` (the
 * footer's) shows the consent once the visitor starts on the form, its
 * field focused or filled (`ui.css` `.gf-news`); before that the field
 * and the button stand alone. Without `:has()` the consent always shows.
 */
export function NewsletterForm({
  action,
  privacyPath,
  words,
  id,
  quiet = false,
  marks,
  className,
}: {
  action: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  privacyPath: string | null
  words: NewsletterWords
  id: string
  quiet?: boolean
  /** The theme editor's live preview (adr/0065 Faz 2b): the consent sentence carries its field mark (`text`). */
  marks?: boolean | undefined
  className?: string
}) {
  const [sent, setSent] = useState(false)
  const { error, pending, onSubmit } = useChallengeForm(async (state, form) => {
    const result = await action(state, form)
    if (result.ok) {
      setSent(true)
    }
    return result
  })
  if (sent) {
    return (
      <p role="status" className={cn("text-md font-semibold", className)}>
        {words.sent}
      </p>
    )
  }
  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-3", quiet && "gf-news", className)}>
      <label htmlFor={`${id}-eposta`} className="text-sm font-semibold">
        {words.email}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`${id}-eposta`}
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          // `:placeholder-shown` also tells an empty field from a filled one
          placeholder={words.placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-durum`}
          className="gf-field min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className="gf-btn shrink-0"
        >
          {words.submit}
        </button>
      </div>
      <div className="gf-news-more flex flex-col gap-3">
        <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed">
          <input
            type="checkbox"
            name="consent"
            value="1"
            required
            className="mt-0.5 size-5 shrink-0 accent-(--color-signal)"
          />
          <span {...fieldMark(marks, "text")}>
            {words.consent}{" "}
            {privacyPath && (
              <a href={privacyPath} className="font-semibold underline">
                {words.privacyLink}
              </a>
            )}
          </span>
        </label>
        <p id={`${id}-durum`} role="alert" className="min-h-[1lh] text-sm font-semibold">
          {error ? (words.errors[error] ?? words.fallback) : null}
        </p>
      </div>
    </form>
  )
}
