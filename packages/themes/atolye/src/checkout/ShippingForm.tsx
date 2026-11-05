"use client"

import { Truck } from "lucide-react"
import { useActionState } from "react"
import type { ActionResult, FormAction, ShippingOptionView } from "@qticaret/ui"
import { ChoiceRow, FieldError } from "./fields"

const INITIAL: ActionResult = { ok: false, error: null }

export interface ShippingWords {
  legend: string
  none: string
  submit: string
  saving: string
  errors: Record<string, string>
  fallback: string
}

/**
 * The carriers the backend offered this address, each a filled row with
 * its delivery promise and its price (the backend's, in words); the first
 * chosen unless the cart holds another. One button goes on to payment.
 */
export function ShippingForm({
  options,
  selected,
  choose,
  words,
}: {
  options: ShippingOptionView[]
  selected: string | null
  choose: FormAction
  words: ShippingWords
}) {
  const [state, submit, pending] = useActionState(choose, INITIAL)
  if (options.length === 0) {
    return <p className="rounded-media bg-field p-4 text-sm font-semibold">{words.none}</p>
  }
  return (
    <form action={submit} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3" aria-describedby="kargo-hata">
        <legend className="sr-only">{words.legend}</legend>
        {options.map((option, index) => (
          <ChoiceRow
            key={option.id}
            name="option_id"
            value={option.id}
            required
            defaultChecked={selected ? option.id === selected : index === 0}
            aside={<span className="tabular shrink-0 text-md font-extrabold">{option.price}</span>}
          >
            <Truck className="size-5 shrink-0 text-text-2" aria-hidden="true" strokeWidth={1.75} />
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{option.name}</span>
              {option.detail && option.detail !== option.name && (
                <span className="text-sm text-text-2">{option.detail}</span>
              )}
            </span>
          </ChoiceRow>
        ))}
      </fieldset>
      <div role="alert">
        <FieldError
          id="kargo-hata"
          message={state.error ? (words.errors[state.error] ?? words.fallback) : null}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="gf-btn w-full sm:w-auto sm:self-start"
      >
        {pending ? words.saving : words.submit}
      </button>
    </form>
  )
}
