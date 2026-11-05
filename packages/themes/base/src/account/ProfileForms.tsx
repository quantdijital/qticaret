"use client"

import { Check, LoaderCircle } from "lucide-react"
import type { AccountPageView, ActionResult, FormAction } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { useKeptForm } from "@qticaret/ui/hooks/use-kept-form"
import { TextField } from "../checkout/fields"

export interface ProfileWords {
  firstName: string
  lastName: string
  phone: string
  save: string
  saving: string
  saved: string
  marketingTitle: string
  marketingEmail: string
  marketingSms: string
  errors: Record<string, string>
  fallback: string
}

function Status({ state, words }: { state: ActionResult; words: ProfileWords }) {
  return (
    <p role="status" className="text-sm font-medium empty:hidden">
      {state.error ? (
        <span className="text-sale">{words.errors[state.error] ?? words.fallback}</span>
      ) : state.ok ? (
        <span className="flex items-center gap-1.5 text-success">
          <Check className="size-4" aria-hidden="true" />
          {words.saved}
        </span>
      ) : null}
    </p>
  )
}

/** The customer's name and phone; refused, as typed. */
export function ProfileForm({
  profile,
  save,
  words,
}: {
  profile: AccountPageView["profile"]
  save: FormAction
  words: ProfileWords
}) {
  const { state, pending, form } = useKeptForm(save)
  return (
    <form {...form} className="grid gap-4 sm:grid-cols-2">
      <TextField
        id="first_name"
        name="first_name"
        label={words.firstName}
        defaultValue={profile.first_name}
        autoComplete="given-name"
        required
      />
      <TextField
        id="last_name"
        name="last_name"
        label={words.lastName}
        defaultValue={profile.last_name}
        autoComplete="family-name"
        required
      />
      <TextField
        id="phone"
        name="phone"
        type="tel"
        label={words.phone}
        defaultValue={profile.phone}
        autoComplete="tel-national"
        className="sm:col-span-2"
      />
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <Button type="submit" disabled={pending} className="h-11 rounded-button px-6">
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {pending ? words.saving : words.save}
        </Button>
        <Status state={state} words={words} />
      </div>
    </form>
  )
}

/** The marketing consents, each channel its own box. */
export function ConsentForm({
  profile,
  save,
  words,
}: {
  profile: AccountPageView["profile"]
  save: FormAction
  words: ProfileWords
}) {
  const { state, pending, form } = useKeptForm(save)
  return (
    <form {...form} className="flex flex-col gap-3">
      <input type="hidden" name="marketing_version" value={profile.marketingVersion} />
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="marketing_email"
          defaultChecked={profile.marketingEmail}
          className="mt-0.5 size-4.5 shrink-0 accent-foreground"
        />
        <span>{words.marketingEmail}</span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="marketing_sms"
          defaultChecked={profile.marketingSms}
          className="mt-0.5 size-4.5 shrink-0 accent-foreground"
        />
        <span>{words.marketingSms}</span>
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          className="h-11 rounded-button bg-transparent px-6 shadow-none"
        >
          {pending ? words.saving : words.save}
        </Button>
        <Status state={state} words={words} />
      </div>
    </form>
  )
}
