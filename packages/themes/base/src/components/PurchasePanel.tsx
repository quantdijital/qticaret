"use client"

import { useActionState, useMemo, useState } from "react"
import type { ActionResult, FormAction, ProductOptionView, VariantView } from "@qticaret/ui"

export interface PurchaseLabels {
  quantity: string
  add: string
  adding: string
  added: string
  outOfStock: string
  chooseOptions: string
  /** Translated error messages by key; unknown keys show `fallbackError`. */
  errors: Record<string, string>
  fallbackError: string
  before: string
}

interface PurchasePanelProps {
  options: ProductOptionView[]
  variants: VariantView[]
  selectedVariantId: string | null
  addToCart: FormAction
  labels: PurchaseLabels
}

const INITIAL: ActionResult = { ok: false, error: null }

/**
 * Option choice, price and the add-to-cart form. A choice updates
 * `?variant=` in place (replaceState: the back button still leaves the page,
 * docs/03 F18). Without JavaScript the form still posts the first variant.
 */
export function PurchasePanel({
  options,
  variants,
  selectedVariantId,
  addToCart,
  labels,
}: PurchasePanelProps) {
  const initial =
    variants.find((variant) => variant.id === selectedVariantId) ?? variants[0] ?? null
  const [chosen, setChosen] = useState<Record<string, string>>(initial?.options ?? {})
  const [state, submit, pending] = useActionState(addToCart, INITIAL)
  // A new choice makes the last answer stale: it was about the previous variant
  const [stale, setStale] = useState(false)

  const variant = useMemo(
    () =>
      variants.find((each) =>
        options.every((option) => each.options[option.id] === chosen[option.id])
      ) ?? null,
    [variants, options, chosen]
  )

  function choose(optionId: string, value: string) {
    const next = { ...chosen, [optionId]: value }
    setChosen(next)
    setStale(true)
    const match = variants.find((each) =>
      options.every((option) => each.options[option.id] === next[option.id])
    )
    if (match) {
      const url = new URL(window.location.href)
      url.searchParams.set("variant", match.id)
      window.history.replaceState(window.history.state, "", url)
    }
  }

  const available = variant?.available ?? false
  return (
    <form
      action={(form) => {
        setStale(false)
        submit(form)
      }}
      className="flex flex-col gap-5"
    >
      {variant?.price && (
        <p className="flex flex-wrap items-baseline gap-2">
          {variant.price.before && (
            <s className="text-sm text-muted-foreground">
              <span className="sr-only">{labels.before} </span>
              {variant.price.before}
            </s>
          )}
          <span
            className={
              variant.price.before ? "text-2xl font-semibold text-sale" : "text-2xl font-semibold"
            }
          >
            {variant.price.current}
          </span>
        </p>
      )}
      {options.map((option) => (
        <fieldset key={option.id} className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{option.title}</legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const id = `option-${option.id}-${value}`
              return (
                <label
                  key={value}
                  htmlFor={id}
                  className="cursor-pointer rounded-full border border-border px-4 py-2 text-sm has-[:checked]:border-foreground has-[:checked]:bg-foreground has-[:checked]:text-background"
                >
                  <input
                    id={id}
                    type="radio"
                    name={`option_${option.id}`}
                    value={value}
                    checked={chosen[option.id] === value}
                    onChange={() => {
                      choose(option.id, value)
                    }}
                    className="sr-only"
                  />
                  {value}
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
      <input type="hidden" name="variant_id" value={variant?.id ?? ""} />
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {labels.quantity}
          <input
            type="number"
            name="quantity"
            min={1}
            max={99}
            defaultValue={1}
            inputMode="numeric"
            className="w-20 rounded-md border border-border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={!available || pending}
          className="flex-1 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? labels.adding
            : available
              ? labels.add
              : variant
                ? labels.outOfStock
                : labels.chooseOptions}
        </button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {!stale && state.ok && <span className="text-success">{labels.added}</span>}
        {!stale && state.error && (
          <span className="text-sale">{labels.errors[state.error] ?? labels.fallbackError}</span>
        )}
      </p>
    </form>
  )
}
