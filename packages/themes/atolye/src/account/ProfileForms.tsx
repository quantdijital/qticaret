"use client"

import { Check, CircleAlert } from "lucide-react"
import { useActionState } from "react"
import type { AccountPageView, ActionResult, FormAction } from "@qticaret/ui"
import { CheckField, TextField } from "../checkout/fields"
import type { PlaceholderWords } from "../parts/placeholders"

const INITIAL: ActionResult = { ok: false, error: null }

export interface SaveWords {
  save: string
  saving: string
  saved: string
  errors: Record<string, string>
  fallback: string
}

/**
 * The answer beside a form's button: "Kaydedildi" with a tick in the
 * "ok" green, or the refusal in words with its icon; read out when it
 * changes. A refusal that belongs to a field is said under that field.
 */
export function SaveStatus({
  state,
  words,
  fieldErrors = [],
}: {
  state: ActionResult
  words: SaveWords
  fieldErrors?: readonly string[]
}) {
  const general = state.error && !fieldErrors.includes(state.error) ? state.error : null
  return (
    <p role="status" className="flex items-center gap-1.5 text-sm font-semibold empty:hidden">
      {general ? (
        <span className="flex items-start gap-1.5 text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
          {words.errors[general] ?? words.fallback}
        </span>
      ) : state.ok ? (
        <span className="flex items-center gap-1.5 text-ok">
          <Check className="size-4" aria-hidden="true" strokeWidth={2.5} />
          {words.saved}
        </span>
      ) : null}
    </p>
  )
}

/** The button and the answer beside it, one row. */
export function SaveRow({
  pending,
  state,
  words,
  fieldErrors,
}: {
  pending: boolean
  state: ActionResult
  words: SaveWords
  fieldErrors?: readonly string[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={pending} aria-busy={pending || undefined} className="gf-btn">
        {pending ? words.saving : words.save}
      </button>
      <SaveStatus state={state} words={words} fieldErrors={fieldErrors ?? []} />
    </div>
  )
}

export interface ProfileWords extends SaveWords {
  firstName: string
  lastName: string
  phone: string
  phoneHint: string
  placeholders: PlaceholderWords
}

/** The customer's name and phone; a refusal said under its field. */
export function ProfileForm({
  profile,
  save,
  words,
}: {
  profile: AccountPageView["profile"]
  save: FormAction
  words: ProfileWords
}) {
  const [state, submit, pending] = useActionState(save, INITIAL)
  const fieldError = (key: string) => (state.error === key ? (words.errors[key] ?? null) : null)
  return (
    <form action={submit} className="grid gap-5 sm:grid-cols-2 sm:gap-4">
      <TextField
        id="first_name"
        name="first_name"
        label={words.firstName}
        placeholder={words.placeholders.firstName}
        defaultValue={profile.first_name}
        error={fieldError("checkout.name_required")}
        autoComplete="given-name"
        required
        maxLength={60}
      />
      <TextField
        id="last_name"
        name="last_name"
        label={words.lastName}
        placeholder={words.placeholders.lastName}
        defaultValue={profile.last_name}
        autoComplete="family-name"
        required
        maxLength={60}
      />
      <TextField
        id="phone"
        name="phone"
        type="tel"
        label={words.phone}
        placeholder={words.placeholders.phone}
        hint={words.phoneHint}
        defaultValue={profile.phone}
        error={fieldError("checkout.phone_invalid")}
        autoComplete="tel-national"
        inputMode="tel"
        className="sm:col-span-2"
      />
      <div className="sm:col-span-2">
        <SaveRow
          pending={pending}
          state={state}
          words={words}
          fieldErrors={["checkout.name_required", "checkout.phone_invalid"]}
        />
      </div>
    </form>
  )
}

export interface ConsentWords extends SaveWords {
  email: string
  sms: string
}

/** The marketing consents (İYS), each channel its own box, as given now. */
export function ConsentForm({
  profile,
  save,
  words,
}: {
  profile: AccountPageView["profile"]
  save: FormAction
  words: ConsentWords
}) {
  const [state, submit, pending] = useActionState(save, INITIAL)
  return (
    <form action={submit} className="flex flex-col gap-4">
      <input type="hidden" name="marketing_version" value={profile.marketingVersion} />
      <div className="flex flex-col rounded-media bg-field px-4 py-2">
        <CheckField name="marketing_email" defaultChecked={profile.marketingEmail}>
          {words.email}
        </CheckField>
        <CheckField name="marketing_sms" defaultChecked={profile.marketingSms}>
          {words.sms}
        </CheckField>
      </div>
      <SaveRow pending={pending} state={state} words={words} />
    </form>
  )
}
