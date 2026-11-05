"use client"

import { Check } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { formatLira } from "@qticaret/ui"
import type {
  AddonFieldView,
  FormAction,
  InstallmentFamilyView,
  PlaceOrderResult,
  ProductOptionView,
  VariantView,
} from "@qticaret/ui"
import { Badge } from "@qticaret/ui/components/badge"
import { Button } from "@qticaret/ui/components/button"
import { useKeptForm } from "@qticaret/ui/hooks/use-kept-form"
import { emitShopEvent } from "@qticaret/ui/lib/shop-events"
import { cn } from "@qticaret/ui/lib/utils"
import { CART_ADDED_EVENT } from "../layout/CartDrawer"
import { AddonFields } from "./AddonFields"
import type { AddonWords } from "./AddonFields"
import { picksKurus, picksLimit, picksOf } from "./addon-picks"
import { GiftFields } from "./GiftFields"
import type { GiftWords } from "./GiftFields"
import { InstallmentTable } from "./InstallmentTable"
import type { InstallmentWords } from "./InstallmentTable"
import { QuantityField } from "./QuantityField"
import { OptionPicker } from "./OptionPicker"
import { StockAlertForm } from "./StockAlertForm"
import type { StockAlertWords } from "./StockAlertForm"

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
  /** With `{amount}` where the saving goes. */
  saving: string
}

interface PurchasePanelProps {
  options: ProductOptionView[]
  variants: VariantView[]
  selectedVariantId: string | null
  addToCart: FormAction
  labels: PurchaseLabels
  /** "Tell me when it is back", shown for a variant out of stock. */
  stockAlert: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  signedIn: boolean
  alertWords: StockAlertWords
  installments: (variantId: string) => Promise<InstallmentFamilyView[] | null>
  installmentWords: InstallmentWords
  /** A gift card (adr/0025 Ek 2026-11-03): the form asks its recipient and sends it to this action instead. */
  gift?: { action: FormAction; words: GiftWords } | null
  /**
   * The product's add-ons (adr/0052): the form asks them above the button
   * and sends them to this action instead; `total` and `totalCount`
   * ("{count} adet") word the running total, `limit` ("{max}") the units
   * the picks allow on one line.
   */
  addons?: {
    action: FormAction
    productId: string
    fields: AddonFieldView[]
    words: AddonWords & { total: string; totalCount: string; limit: string }
  } | null
}

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
  stockAlert,
  signedIn,
  alertWords,
  installments,
  installmentWords,
  gift = null,
  addons = null,
}: PurchasePanelProps) {
  const initial =
    variants.find((variant) => variant.id === selectedVariantId) ?? variants[0] ?? null
  const [chosen, setChosen] = useState<Record<string, string>>(initial?.options ?? {})
  // Refused, the picks, the count and a gift's words stay as they were
  const { state, pending, form } = useKeptForm(gift?.action ?? addons?.action ?? addToCart)
  // The add-on picks as typed and the quantity, for the running total and the units allowed
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)
  // What was sent, for the storefront's "added to cart" (it decides whether anything is measured)
  const sent = useRef<{ variantId: string; quantity: number } | null>(null)
  // A new choice makes the last answer stale: it was about the previous variant
  const [stale, setStale] = useState(false)
  const variant = useMemo(() => matching(variants, options, chosen), [variants, options, chosen])
  // A line that went in opens the header's cart drawer
  useEffect(() => {
    if (state.ok) {
      window.dispatchEvent(new Event(CART_ADDED_EVENT))
      if (sent.current) {
        emitShopEvent({ type: "add_to_cart", ...sent.current })
        sent.current = null
      }
    }
  }, [state])

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
  const fields = addons?.fields ?? []
  const limit = picksLimit(fields, picks)
  const units = Math.min(quantity, limit ?? 99)
  const extra = picksKurus(fields, picks)
  // Shown only: the line's price is the server's once it is added (CLAUDE.md rule 5)
  const total =
    typeof variant?.kurus === "number" && extra > 0 ? (variant.kurus + extra) * units : null
  return (
    <>
      <form
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
        onChange={(event) => {
          const target = event.target as { name?: unknown }
          if (typeof target.name === "string" && target.name.startsWith("addon_")) {
            setPicks(picksOf(event.currentTarget))
          }
        }}
        className="flex flex-col gap-6"
      >
        {price && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="tabular flex flex-wrap items-baseline gap-x-3">
              <span
                className={cn(
                  "text-[2rem] leading-none font-semibold",
                  price.before && "text-sale"
                )}
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
            {/* A cart offer past a minimum (adr/0046 Ek 2026-11-05): beside the price, not in it */}
            {price.cartOffer && (
              <p className="basis-full text-sm font-medium text-sale">{price.cartOffer}</p>
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
        <OptionPicker options={options} chosen={chosen} choose={choose} />
        <input type="hidden" name="variant_id" value={variant?.id ?? ""} />
        {gift && <GiftFields id="hediye" words={gift.words} />}
        {addons && !gift && (
          <>
            <input type="hidden" name="product_id" value={addons.productId} />
            {/* The picks as typed are the fields' defaults: a refused add keeps them */}
            <AddonFields id="ek" fields={fields} values={picks} words={addons.words} />
            {limit !== null && (
              <p className="-mt-3 text-xs text-muted-foreground">
                {addons.words.limit.replace("{max}", String(limit))}
              </p>
            )}
            {total !== null && (
              <p aria-live="polite" className="-mt-2 flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  {addons.words.total}
                  {units > 1 && ` (${addons.words.totalCount.replace("{count}", String(units))})`}
                </span>
                <span className="tabular text-lg font-semibold">{formatLira(total / 100)}</span>
              </p>
            )}
          </>
        )}
        <div className="flex gap-3">
          <QuantityField
            name="quantity"
            label={labels.quantity}
            decrease={labels.decrease}
            increase={labels.increase}
            max={limit ?? 99}
            onValueChange={setQuantity}
          />
          <Button
            type="submit"
            size="lg"
            disabled={!available || pending}
            className="h-12 flex-1 rounded-button text-base"
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
      {variant && available && (
        <InstallmentTable variantId={variant.id} load={installments} words={installmentWords} />
      )}
      {/* Outside the purchase form: a form may not hold another */}
      {variant && !available && (
        <StockAlertForm
          key={variant.id}
          variantId={variant.id}
          signedIn={signedIn}
          action={stockAlert}
          words={alertWords}
        />
      )}
    </>
  )
}
