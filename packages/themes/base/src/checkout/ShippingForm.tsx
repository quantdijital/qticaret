"use client"

import { ArrowRight, LoaderCircle, Truck } from "lucide-react"
import { useActionState } from "react"
import type { ActionResult, FormAction, ShippingOptionView } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"

const INITIAL: ActionResult = { ok: false, error: null }

export interface ShippingWords {
  none: string
  submit: string
  saving: string
  errors: Record<string, string>
  fallback: string
}

/** The shipping options the backend offered this address, as large radio cards. */
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
    return <p className="rounded-2xl bg-muted p-4 text-sm">{words.none}</p>
  }
  return (
    <form action={submit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">{words.submit}</legend>
        {options.map((option, index) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-4 rounded-2xl border bg-background p-4 transition-colors hover:border-foreground/30 has-[:checked]:border-foreground has-[:checked]:bg-card has-[:checked]:ring-1 has-[:checked]:ring-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
          >
            <input
              type="radio"
              name="option_id"
              value={option.id}
              required
              defaultChecked={selected ? option.id === selected : index === 0}
              className="size-4 accent-foreground"
            />
            <Truck className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="flex flex-1 flex-col">
              <span className="font-medium">{option.name}</span>
              {option.detail && (
                <span className="text-sm text-muted-foreground">{option.detail}</span>
              )}
            </span>
            <span className="tabular font-semibold">{option.price}</span>
          </label>
        ))}
      </fieldset>
      <p role="alert" className="text-sm font-medium text-sale empty:hidden">
        {state.error ? (words.errors[state.error] ?? words.fallback) : null}
      </p>
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-12 rounded-button px-7 text-[15px] sm:self-start"
      >
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {pending ? words.saving : words.submit}
        {!pending && <ArrowRight aria-hidden="true" />}
      </Button>
    </form>
  )
}
