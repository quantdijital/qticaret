"use client"

import { CircleCheck } from "lucide-react"
import { useState } from "react"
import type { BookingView, PlaceOrderResult } from "@qticaret/ui"
import { CheckField, FieldError, SelectField, TextField } from "../checkout/fields"
import { useChallengeForm } from "../frame/useChallengeForm"
import type { RequestWords } from "./request-words"

const FLEXIBLE = "flexible"
const MONTH = "month"

/**
 * A dated product's "call me" form (adr/0076 Ek 2026-11-23): who to call
 * (the phone required, the address optional), when (a departure on the
 * list, a month, or open dates), how many people, a note, and the consent
 * to the privacy notice. No payment, no places held; the shop calls back.
 * Past a request an hour from one address the backend asks a proof of
 * work, solved here. Sent, the form says so in its place.
 */
export function BookingRequest({
  productId,
  view,
  action,
  words,
  id = "sizi-arayalim",
}: {
  productId: string
  view: BookingView
  action: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  words: RequestWords
  /** The form's heading id; its fields' ids start with it. */
  id?: string
}) {
  // Only departures on sale; the server turns a closed one down (adr/0076 Ek 2026-11-23)
  const departures = view.departures.filter((departure) => departure.status === "open")
  const months = view.requestMonths ?? []
  const [when, setWhen] = useState<string>(() => departures[0]?.id ?? FLEXIBLE)
  const [sent, setSent] = useState(false)
  const { error, checking, pending, onSubmit, slot } = useChallengeForm(
    async (state, form) => {
      const result = await action(state, form)
      if (result.ok) {
        setSent(true)
      }
      return result
    },
    // A booking request shares the contact form's gate and counter (adr/0044 Ek 2026-11-24)
    { action: "contact", className: "sm:col-span-2" }
  )
  const optional = (label: string) => `${label} (${words.optional})`
  const field = (name: string) => `${id}-${name}`
  const message = error ? (words.errors[error] ?? words.fallback) : null
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-media gf-box p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-md font-semibold">
          {words.title}
        </h2>
        <p className="text-sm text-text-2">{words.intro}</p>
      </div>
      {sent ? (
        <p role="status" className="flex items-start gap-3 text-md font-semibold">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
          {words.sent}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="product_id" value={productId} />
          <TextField
            id={field("ad")}
            name="name"
            label={words.name}
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
          />
          <TextField
            id={field("telefon")}
            type="tel"
            name="phone"
            label={words.phone}
            required
            maxLength={20}
            autoComplete="tel"
            inputMode="tel"
          />
          <TextField
            id={field("eposta")}
            type="email"
            name="email"
            label={optional(words.email)}
            maxLength={254}
            autoComplete="email"
            className="sm:col-span-2"
          />
          <SelectField
            id={field("tarih")}
            name="when"
            label={words.when}
            value={when}
            onChange={(event) => {
              setWhen(event.target.value)
            }}
            className="sm:col-span-2"
          >
            {departures.map((departure) => (
              <option key={departure.id} value={departure.id}>
                {departure.label}
              </option>
            ))}
            {months.length > 0 && <option value={MONTH}>{words.month}</option>}
            <option value={FLEXIBLE}>{words.flexible}</option>
          </SelectField>
          {when === MONTH && (
            <SelectField
              id={field("ay")}
              name="month"
              label={words.monthField}
              required
              defaultValue={months[0]?.value}
              className="sm:col-span-2"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </SelectField>
          )}
          <TextField
            id={field("yetiskin")}
            type="number"
            name="adults"
            label={words.adults}
            required
            min={1}
            max={view.maxUnits}
            defaultValue={1}
            inputMode="numeric"
          />
          <TextField
            id={field("cocuk")}
            type="number"
            name="children"
            label={optional(words.children)}
            min={0}
            max={view.maxUnits}
            defaultValue={0}
            inputMode="numeric"
          />
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
            <label htmlFor={field("not")} className="text-sm font-semibold">
              {words.note}
            </label>
            <textarea
              id={field("not")}
              name="note"
              maxLength={1000}
              rows={3}
              className="gf-field min-h-24 rounded-[min(var(--button-radius),var(--radius-media))] py-3"
            />
          </div>
          <CheckField name="consent" value="1" required className="sm:col-span-2">
            {words.consent}{" "}
            {view.privacyPath && (
              <a
                href={view.privacyPath}
                target="_blank"
                rel="noopener"
                className="font-semibold underline underline-offset-4"
              >
                {words.privacyLink}
              </a>
            )}
          </CheckField>
          {slot}
          <div role="alert" className="empty:hidden sm:col-span-2">
            {message && <FieldError id={field("hata")} message={message} />}
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

/**
 * The secondary "call me" button under the cart's (sale mode `both`): it
 * opens the request form below it.
 */
export function BookingRequestToggle(props: Parameters<typeof BookingRequest>[0]) {
  const [open, setOpen] = useState(false)
  const panel = `${props.id ?? "sizi-arayalim"}-panel`
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => {
          setOpen((now) => !now)
        }}
        className="gf-btn gf-btn--quiet w-full sm:w-auto"
      >
        {props.words.open}
      </button>
      <div id={panel} hidden={!open}>
        {open && <BookingRequest {...props} />}
      </div>
    </div>
  )
}
