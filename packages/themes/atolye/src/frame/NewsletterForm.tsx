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
 *
 * `joined` (the newsletter variants after `standard`, adr/0049 Ek
 * 2026-11-17): the label read by screen readers only (the heading beside
 * it names the box), the field and the button one piece (`.gf-join`,
 * newsletter.css), the privacy notice's link always under it on its own
 * line (the consent sentence then without it); the sending, the consent
 * box and the messages as above.
 *
 * `words.style` `line` (the box's consent setting): no consent box and
 * nothing that opens on focus; one small line under the form, always
 * shown, says that subscribing is consenting, with the privacy notice's
 * link (the joined forms' own link line then not drawn). The form says so
 * to the server (`consent` `line`), which names those words' version in
 * the proof; the address's owner still confirms by the e-mailed link.
 */
export function NewsletterForm({
  action,
  privacyPath,
  words,
  id,
  quiet = false,
  joined = false,
  marks,
  textKey = "text",
  className,
}: {
  action: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  privacyPath: string | null
  words: NewsletterWords
  id: string
  quiet?: boolean
  joined?: boolean
  /** The theme editor's live preview (adr/0065 Faz 2b): the consent sentence carries its field mark (`text`). */
  marks?: boolean | undefined
  /** The consent sentence's field key; a free rows footer's block names its own (`blocks.<at>.text`). */
  textKey?: string
  className?: string
}) {
  const [sent, setSent] = useState(false)
  const { error, pending, onSubmit, slot } = useChallengeForm(
    async (state, form) => {
      const result = await action(state, form)
      if (result.ok) {
        setSent(true)
      }
      return result
    },
    { action: "newsletter" }
  )
  if (sent) {
    return (
      <p role="status" className={cn("text-md font-semibold", className)}>
        {words.sent}
      </p>
    )
  }
  const privacy = privacyPath && (
    <a href={privacyPath} className="font-semibold underline">
      {words.privacyLink}
    </a>
  )
  const line = words.style === "line"
  const status = (
    // The line keeps no empty row for a message it has not said
    <p
      id={`${id}-durum`}
      role="alert"
      className={cn(!line && "min-h-[1lh]", "text-sm font-semibold")}
    >
      {error ? (words.errors[error] ?? words.fallback) : null}
    </p>
  )
  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "flex flex-col",
        joined ? "gap-2" : "gap-3",
        quiet && !line && "gf-news",
        className
      )}
    >
      <label htmlFor={`${id}-eposta`} className={joined ? "sr-only" : "text-sm font-semibold"}>
        {words.email}
      </label>
      <div className={joined ? "gf-join" : "flex flex-col gap-2 sm:flex-row"}>
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
          aria-describedby={line ? `${id}-onay ${id}-durum` : `${id}-durum`}
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
      {line ? (
        <>
          <input type="hidden" name="consent" value="line" />
          <p id={`${id}-onay`} className="text-xs leading-relaxed">
            <span {...fieldMark(marks, textKey)}>{words.consent}</span>
            {privacy ? " " : null}
            {privacy}
          </p>
          {slot}
          {status}
        </>
      ) : (
        <>
          <div className="gf-news-more flex flex-col gap-3">
            <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed">
              <input
                type="checkbox"
                name="consent"
                value="1"
                required
                className="mt-0.5 size-5 shrink-0 accent-(--color-signal)"
              />
              <span {...fieldMark(marks, textKey)}>
                {words.consent}
                {joined ? null : " "}
                {joined ? null : privacy}
              </span>
            </label>
            {slot}
            {status}
          </div>
          {joined && privacy ? <p className="gf-news-privacy text-xs">{privacy}</p> : null}
        </>
      )}
    </form>
  )
}
