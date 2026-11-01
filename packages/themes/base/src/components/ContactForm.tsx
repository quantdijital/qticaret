"use client"

import { useState } from "react"
import type { ContactFormView, PlaceOrderResult } from "@qticaret/ui"
import { useChallengeForm } from "../account/useChallengeForm"

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
}

const FIELD =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm aria-invalid:border-sale"

/**
 * The contact form (adr/0047): the shop answers by e-mail. Past a message
 * an hour from one address the backend asks a proof of work, solved here.
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
  if (sent) {
    return (
      <p role="status" className="rounded-2xl border bg-card p-6 text-success">
        {words.sent}
      </p>
    )
  }
  return (
    <section aria-labelledby="iletisim-formu" className="rounded-2xl border bg-card p-6 sm:p-8">
      <h2 id="iletisim-formu" className="mb-6 text-2xl">
        {words.title}
      </h2>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {words.name}
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            defaultValue={view.name ?? ""}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {words.email}
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            autoComplete="email"
            defaultValue={view.email ?? ""}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          <span>
            {words.phone} <span className="text-muted-foreground">({words.optional})</span>
          </span>
          <input
            type="tel"
            name="phone"
            maxLength={20}
            autoComplete="tel"
            inputMode="tel"
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {words.subject}
          <select name="subject" required defaultValue="" className={FIELD}>
            <option value="" disabled />
            {view.subjects.map((subject) => (
              <option key={subject.value} value={subject.value}>
                {subject.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          <span>
            {words.orderNumber} <span className="text-muted-foreground">({words.optional})</span>
          </span>
          <input
            name="order_number"
            maxLength={13}
            inputMode="numeric"
            pattern="#?[0-9]{1,12}"
            className={`${FIELD} sm:max-w-xs`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          {words.body}
          <textarea
            name="body"
            required
            minLength={10}
            maxLength={3000}
            rows={6}
            className="w-full rounded-lg border border-input bg-background p-3 text-sm"
          />
        </label>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {words.privacy}{" "}
          {view.privacyPath && (
            <a href={view.privacyPath} className="underline underline-offset-4">
              {words.privacyLink}
            </a>
          )}
        </p>
        <p role="alert" className="text-sm text-sale empty:hidden sm:col-span-2">
          {error ? (words.errors[error] ?? words.fallback) : null}
        </p>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="h-12 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {checking ? words.checking : words.submit}
          </button>
        </div>
      </form>
    </section>
  )
}
