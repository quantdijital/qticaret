"use client"

import { CircleCheck } from "lucide-react"
import { useState } from "react"
import type { ContactFormView, PlaceOrderResult } from "@qticaret/ui"
import { FieldError, SelectField, TextField } from "../checkout/fields"
import type { PlaceholderWords } from "../parts/placeholders"
import { useChallengeForm } from "../frame/useChallengeForm"

export interface ContactWords {
  title: string
  name: string
  email: string
  phone: string
  optional: string
  subject: string
  orderNumber: string
  body: string
  privacy: string
  privacyLink: string
  submit: string
  checking: string
  sent: string
  errors: Record<string, string>
  fallback: string
  placeholders: PlaceholderWords
}

/**
 * The contact form (adr/0047) on a filled well: 48 px pill fields with
 * their labels above, the message a rounded box, the shop's colour on the
 * one button. The shop answers by e-mail; past a message an hour from one
 * address the backend asks a proof of work, solved here. Sent, the well
 * says so in place.
 */
export function ContactForm({
  view,
  action,
  words,
}: {
  view: ContactFormView
  action: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  words: ContactWords
}) {
  const [sent, setSent] = useState(false)
  const { error, checking, pending, onSubmit } = useChallengeForm(async (state, form) => {
    const result = await action(state, form)
    if (result.ok) {
      setSent(true)
    }
    return result
  })
  const optional = (label: string) => `${label} (${words.optional})`
  const ph = words.placeholders
  return (
    <section
      aria-labelledby="iletisim-formu"
      className="flex flex-col gap-6 rounded-tile gf-pane p-6 sm:p-8 lg:p-10"
    >
      <h2 id="iletisim-formu" className="text-section">
        {words.title}
      </h2>
      {sent ? (
        <p role="status" className="flex items-start gap-3 text-md font-semibold">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
          {words.sent}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="iletisim-ad"
            name="name"
            label={words.name}
            placeholder={ph.nameExample}
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            defaultValue={view.name ?? ""}
          />
          <TextField
            id="iletisim-eposta"
            type="email"
            name="email"
            label={words.email}
            placeholder={ph.email}
            required
            maxLength={254}
            autoComplete="email"
            defaultValue={view.email ?? ""}
          />
          <TextField
            id="iletisim-telefon"
            type="tel"
            name="phone"
            label={optional(words.phone)}
            placeholder={ph.phone}
            maxLength={20}
            autoComplete="tel"
            inputMode="tel"
          />
          <SelectField
            id="iletisim-konu"
            name="subject"
            label={words.subject}
            required
            defaultValue=""
          >
            <option value="" disabled>
              {ph.subject}
            </option>
            {view.subjects.map((subject) => (
              <option key={subject.value} value={subject.value}>
                {subject.label}
              </option>
            ))}
          </SelectField>
          <TextField
            id="iletisim-siparis"
            name="order_number"
            label={optional(words.orderNumber)}
            placeholder={ph.orderNumber}
            maxLength={13}
            inputMode="numeric"
            pattern="#?[0-9]{1,12}"
            className="sm:col-span-2 sm:max-w-xs"
          />
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="iletisim-mesaj" className="text-sm font-semibold">
              {words.body}
            </label>
            <textarea
              id="iletisim-mesaj"
              name="body"
              required
              minLength={10}
              maxLength={3000}
              rows={6}
              placeholder={ph.message}
              className="gf-field min-h-40 rounded-[min(var(--button-radius),var(--radius-media))] py-3"
            />
          </div>
          <p className="text-sm text-text-2 sm:col-span-2">
            {words.privacy}{" "}
            {view.privacyPath && (
              <a href={view.privacyPath} className="font-semibold underline underline-offset-4">
                {words.privacyLink}
              </a>
            )}
          </p>
          <div role="alert" className="empty:hidden sm:col-span-2">
            {error && (
              <FieldError id="iletisim-hata" message={words.errors[error] ?? words.fallback} />
            )}
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending || undefined}
              className="gf-btn w-full sm:w-auto"
            >
              {checking ? words.checking : words.submit}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
