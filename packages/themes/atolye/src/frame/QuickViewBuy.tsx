"use client"

import { CircleAlert } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { FormAction, QuickViewView } from "@qticaret/ui"
import { useKeptForm } from "@qticaret/ui/hooks/use-kept-form"
import { emitShopEvent } from "@qticaret/ui/lib/shop-events"
import { matching, soldOutOf } from "../product/choices"
import { Options } from "../product/Options"
import { Price } from "../product/Price"
import { Quantity } from "../product/Quantity"
import { discountWords, type QuickViewWords } from "./quick-view-words"

/**
 * The quick view's buy part (adr/0049 Ek 2026-11-15), the product page's
 * own parts (`Price`, `Options`, `Quantity`, `matching`): the chosen
 * variant's price in the storefront's words (nothing priced here, CLAUDE.md
 * rule 5), the options as real radios, how many (while the shop shows the
 * field; else one), "Sepete ekle" posting `addToCart`'s fields. A choice
 * changes nothing in the address. Once in, `onAdded` closes the dialog and
 * the cart drawer says so; refused, the reason in words with the product's
 * page as the way on. A product that asks more than this form sends (a gift
 * card's recipient, a required add-on: `needsPage`) has its page's link in
 * the button's place.
 */
export function QuickViewBuy({
  view,
  addToCart,
  words,
  onChoose,
  onAdded,
}: {
  view: QuickViewView
  addToCart: FormAction
  words: QuickViewWords
  /** The chosen variant, for the gallery to show its own pictures first. */
  onChoose: (variantId: string) => void
  onAdded: () => void
}) {
  const formId = useId()
  const { variants, options } = view
  const first = variants.find((each) => each.id === view.selectedVariantId) ?? variants[0] ?? null
  const [chosen, setChosen] = useState<Record<string, string>>(first?.options ?? {})
  const [stale, setStale] = useState(false)
  const { state, pending, form } = useKeptForm(addToCart)
  const sent = useRef<{ variantId: string; quantity: number } | null>(null)
  const variant = useMemo(() => matching(variants, options, chosen), [variants, options, chosen])
  const discounts = useMemo(
    () =>
      discountWords(
        words.discountTemplate,
        variants.map((each) => each.price?.discount ?? null)
      ),
    [variants, words.discountTemplate]
  )

  useEffect(() => {
    if (state.ok && sent.current) {
      emitShopEvent({ type: "add_to_cart", ...sent.current })
      sent.current = null
      onAdded()
    }
  }, [state, onAdded])

  const choose = (optionId: string, value: string) => {
    const next = { ...chosen, [optionId]: value }
    setChosen(next)
    setStale(true)
    const match = matching(variants, options, next)
    if (match) {
      onChoose(match.id)
    }
  }

  const available = variant?.available ?? false
  const label = pending
    ? words.adding
    : available
      ? words.add
      : variant
        ? words.outOfStock
        : words.chooseOptions
  const error = !stale && state.error ? (words.errors[state.error] ?? words.fallback) : null
  return (
    <div className="flex flex-col gap-5">
      {variant?.price && (
        <Price price={variant.price} words={{ ...words, discount: discounts }} compact />
      )}
      <form
        id={formId}
        action={form.action}
        onSubmit={(event) => {
          setStale(false)
          const fields = new FormData(event.currentTarget)
          const variantId = fields.get("variant_id")
          sent.current = {
            variantId: typeof variantId === "string" ? variantId : "",
            quantity: Number(fields.get("quantity") ?? 1) || 1,
          }
          form.onSubmit(event)
        }}
        className="flex flex-col gap-5 [&:not(:has(fieldset))]:hidden"
      >
        <Options
          options={options}
          chosen={chosen}
          choose={choose}
          soldOut={soldOutOf(variants, options, chosen)}
          soldOutLabel={words.outOfStock}
        />
        <input type="hidden" name="variant_id" value={variant?.id ?? ""} />
        {!view.quantity && <input type="hidden" name="quantity" value="1" />}
      </form>
      <div className="@container flex flex-col gap-3">
        {view.needsPage ? (
          // A gift card's recipient or a required add-on: only its page asks it
          <a href={view.path} className="gf-btn min-w-0 flex-1 basis-48">
            {words.openPage}
          </a>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {view.quantity && (
              <Quantity
                form={formId}
                name="quantity"
                max={99}
                words={words}
                onValueChange={() => undefined}
              />
            )}
            <button
              type="submit"
              form={formId}
              disabled={!available || pending}
              aria-busy={pending}
              className="gf-btn min-w-0 flex-1 basis-48"
            >
              {label}
            </button>
          </div>
        )}
        <p role="status" aria-live="polite" className="text-sm empty:hidden">
          {error && (
            <span className="flex items-start gap-2 text-error">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
              <span>
                {error}{" "}
                <a href={view.path} className="font-semibold text-text underline">
                  {words.openPage}
                </a>
              </span>
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
