"use client"

import { Check } from "lucide-react"
import { useActionState, useMemo, useState } from "react"
import type { ActionResult, FormAction, ProductOptionView, VariantView } from "@qticaret/ui"
import { Badge } from "@qticaret/ui/components/badge"
import { Button } from "@qticaret/ui/components/button"
import { cn } from "@qticaret/ui/lib/utils"
import { QuantityField } from "./QuantityField"

export interface PurchaseLabels {
  quantity: string
  decrease: string
  increase: string
  add: string
  adding: string
  added: string
  goToCart: string
  inStock: string
  outOfStock: string
  chooseOptions: string
  /** "%{percent} indirim" for each discount the variants have, by percent. */
  discount: Record<number, string>
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

const matching = (
  variants: VariantView[],
  options: ProductOptionView[],
  chosen: Record<string, string>
) =>
  variants.find((each) =>
    options.every((option) => each.options[option.id] === chosen[option.id])
  ) ?? null

/**
 * Option choice, price, stock and the add-to-cart form. A choice updates
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
  const variant = useMemo(() => matching(variants, options, chosen), [variants, options, chosen])

  function choose(optionId: string, value: string) {
    const next = { ...chosen, [optionId]: value }
    setChosen(next)
    setStale(true)
    const match = matching(variants, options, next)
    if (match) {
      const url = new URL(window.location.href)
      url.searchParams.set("variant", match.id)
      window.history.replaceState(window.history.state, "", url)
    }
  }

  const available = variant?.available ?? false
  const price = variant?.price ?? null
  return (
    <form
      action={(form) => {
        setStale(false)
        submit(form)
      }}
      className="flex flex-col gap-6"
    >
      {price && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="tabular flex flex-wrap items-baseline gap-x-3">
            <span
              className={cn("text-[2rem] leading-none font-semibold", price.before && "text-sale")}
            >
              {price.current}
            </span>
            {price.before && (
              <s className="text-lg text-muted-foreground">
                <span className="sr-only">{labels.before} </span>
                {price.before}
              </s>
            )}
          </p>
          {price.discount !== null && (
            <Badge className="rounded-full bg-sale px-2.5 py-1 text-sale-foreground">
              {labels.discount[price.discount]}
            </Badge>
          )}
        </div>
      )}
      <p className="flex items-center gap-2 text-sm font-medium">
        <span
          aria-hidden="true"
          className={cn(
            "size-2 rounded-full ring-4",
            available ? "bg-success ring-success/15" : "bg-muted-foreground ring-muted"
          )}
        />
        {variant ? (available ? labels.inStock : labels.outOfStock) : labels.chooseOptions}
      </p>
      {options.map((option) => (
        <fieldset key={option.id} className="flex flex-col gap-2.5">
          <legend className="mb-1 text-sm font-medium">
            {option.title}
            {chosen[option.id] && (
              <span className="font-normal text-muted-foreground">: {chosen[option.id]}</span>
            )}
          </legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const id = `option-${option.id}-${value}`
              return (
                <label
                  key={value}
                  htmlFor={id}
                  className="inline-flex h-11 min-w-12 cursor-pointer items-center justify-center rounded-full border bg-card px-5 text-sm font-medium transition-colors hover:border-foreground has-[:checked]:border-foreground has-[:checked]:bg-foreground has-[:checked]:text-background has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
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
      <div className="flex gap-3">
        <QuantityField
          name="quantity"
          label={labels.quantity}
          decrease={labels.decrease}
          increase={labels.increase}
        />
        <Button
          type="submit"
          size="lg"
          disabled={!available || pending}
          className="h-12 flex-1 rounded-full text-base"
        >
          {pending
            ? labels.adding
            : available
              ? labels.add
              : variant
                ? labels.outOfStock
                : labels.chooseOptions}
        </Button>
      </div>
      <p role="status" aria-live="polite" className="min-h-6 text-sm">
        {!stale && state.ok && (
          <span className="flex items-center gap-2 text-success">
            <Check className="size-4" aria-hidden="true" />
            {labels.added}
            <a href="/sepet" className="font-medium text-foreground underline">
              {labels.goToCart}
            </a>
          </span>
        )}
        {!stale && state.error && (
          <span className="text-sale">{labels.errors[state.error] ?? labels.fallbackError}</span>
        )}
      </p>
    </form>
  )
}
