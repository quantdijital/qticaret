"use client"

import { Check, CircleAlert, CircleCheck, CircleSlash } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { formatLira } from "@qticaret/ui"
import type {
  AddonFieldView,
  FormAction,
  ImageView,
  InstallmentFamilyView,
  PlaceOrderResult,
  ProductOptionView,
  VariantView,
} from "@qticaret/ui"
import { useKeptForm } from "@qticaret/ui/hooks/use-kept-form"
import { emitShopEvent } from "@qticaret/ui/lib/shop-events"
import { cn } from "@qticaret/ui/lib/utils"
import { announceCartAdded } from "../frame/events"
import { BuyBar } from "./BuyBar"
import { choiceText, matching, soldOutOf } from "./choices"
import { AddonPicks, GiftRecipientFields, picksKurus, picksLimit, picksOf } from "./Extras"
import { Favorite } from "./Favorite"
import { Installments } from "./Installments"
import { Options } from "./Options"
import { Price } from "./Price"
import { Quantity } from "./Quantity"
import { StockAlert } from "./StockAlert"
import { useScrolledAway } from "./use-scrolled-away"
import { announceVariant, pressedAgain } from "./variant-pictures"
import type {
  AddonWords,
  AlertWords,
  BuyWords,
  FavoriteWords,
  GiftWords,
  InstallmentWords,
} from "./words"

const FORM = "sepet-formu"
const ALERT = "stok-bildirimi"

/**
 * The buy column's working part: the chosen variant's price (with the
 * price-before rule, the saving and a cart offer's note), its stock in
 * words, the options, the add-ons or a gift card's recipient, then one
 * row: how many, "add to cart" in the shop's colour, the favourite heart.
 * A variant to be had says its instalments in one line under the price
 * (the table opens in a dialog); a variant out of stock offers the stock
 * alert under the row. The page's WhatsApp question (`whatsapp`) closes
 * the purchase group, 12 px under the row. A choice writes `?variant=` in
 * place (the back button still leaves the page). Without the script the
 * form still posts the first variant. Once in, the cart sheet opens.
 */
export function Buy({
  productId,
  title,
  image,
  options,
  variants,
  selectedVariantId,
  addToCart,
  gift,
  addons,
  favorite,
  installments,
  stockAlert,
  signedIn,
  whatsapp,
  words,
}: {
  productId: string
  title: string
  image: ImageView | null
  options: ProductOptionView[]
  variants: VariantView[]
  selectedVariantId: string | null
  addToCart: FormAction
  gift: { action: FormAction; words: GiftWords } | null
  addons: { action: FormAction; fields: AddonFieldView[]; words: AddonWords } | null
  favorite: { add: FormAction; loginPath: string; words: FavoriteWords }
  installments: {
    load: (variantId: string) => Promise<InstallmentFamilyView[] | null>
    words: InstallmentWords
  }
  stockAlert: {
    action: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
    words: AlertWords
  }
  signedIn: boolean
  whatsapp: ReactNode
  words: BuyWords
}) {
  const first = variants.find((each) => each.id === selectedVariantId) ?? variants[0] ?? null
  const [chosen, setChosen] = useState<Record<string, string>>(first?.options ?? {})
  // Refused, the picks, the count and a gift's words stay as they were
  const { state, pending, form } = useKeptForm(gift?.action ?? addons?.action ?? addToCart)
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)
  const [stale, setStale] = useState(false)
  const sent = useRef<{ variantId: string; quantity: number } | null>(null)
  const row = useRef<HTMLDivElement>(null)
  // The phone's bar shows once the row with the button has scrolled away above
  const barOpen = useScrolledAway(row)
  const variant = useMemo(() => matching(variants, options, chosen), [variants, options, chosen])

  useEffect(() => {
    if (state.ok && sent.current) {
      announceCartAdded(words.added)
      emitShopEvent({ type: "add_to_cart", ...sent.current })
      sent.current = null
    }
  }, [state, words.added])

  function choose(optionId: string, value: string) {
    const next = { ...chosen, [optionId]: value }
    setChosen(next)
    setStale(true)
    const match = matching(variants, options, next)
    if (match) {
      const url = new URL(window.location.href)
      url.searchParams.set("variant", match.id)
      window.history.replaceState(window.history.state, "", url)
      // Its own pictures come to the front of the gallery
      announceVariant(match.id)
    }
  }

  const available = variant?.available ?? false
  const price = variant?.price ?? null
  const fields = addons?.fields ?? []
  const limit = picksLimit(fields, picks)
  const units = Math.min(quantity, limit ?? 99)
  const extra = picksKurus(fields, picks)
  // Shown only: the server prices the line once it is added (CLAUDE.md rule 5)
  const total =
    typeof variant?.kurus === "number" && extra > 0 ? (variant.kurus + extra) * units : null
  const label = pending
    ? words.adding
    : available
      ? words.add
      : variant
        ? words.outOfStock
        : words.chooseOptions
  const error = !stale && state.error ? (words.errors[state.error] ?? words.fallback) : null
  const plans = variant && available ? (variant.installments ?? null) : null
  return (
    <div className="gf-buy-stack flex flex-col gap-6">
      {price && (
        <div className="flex flex-col gap-3">
          <Price price={price} words={words} />
          {/* One quiet line under the price, the table in a dialog (owner 2026-11-05) */}
          {variant && plans && (
            <Installments
              variantId={variant.id}
              summary={plans}
              load={installments.load}
              words={installments.words}
            />
          )}
        </div>
      )}
      <p
        className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          available ? "text-ok" : "text-text-2"
        )}
      >
        {available ? (
          <CircleCheck className="size-5" aria-hidden="true" strokeWidth={2} />
        ) : (
          <CircleSlash className="size-5" aria-hidden="true" strokeWidth={2} />
        )}
        {variant ? (available ? words.inStock : words.outOfStock) : words.chooseOptions}
      </p>
      <form
        id={FORM}
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
        onClick={(event) => {
          // The choice the page opened on, pressed: its pictures come forward too (no change fires)
          if (variant && pressedAgain(event.target, chosen)) {
            announceVariant(variant.id)
          }
        }}
        className="flex scroll-mt-40 flex-col gap-6 [&:not(:has(fieldset))]:hidden"
      >
        <Options
          options={options}
          chosen={chosen}
          choose={choose}
          soldOut={soldOutOf(variants, options, chosen)}
          soldOutLabel={words.outOfStock}
        />
        <input type="hidden" name="variant_id" value={variant?.id ?? ""} />
        {gift && <GiftRecipientFields words={gift.words} />}
        {addons && !gift && (
          <>
            <input type="hidden" name="product_id" value={productId} />
            <AddonPicks fields={fields} words={addons.words} />
            {limit !== null && (
              <p className="-mt-3 text-xs text-text-2">
                {addons.words.limit.replace("{max}", String(limit))}
              </p>
            )}
            {total !== null && (
              <p aria-live="polite" className="-mt-2 flex items-baseline justify-between text-sm">
                <span className="text-text-2">
                  {addons.words.total}
                  {units > 1 && ` (${addons.words.totalCount.replace("{count}", String(units))})`}
                </span>
                <span className="tabular text-lg font-extrabold">{formatLira(total / 100)}</span>
              </p>
            )}
          </>
        )}
      </form>
      <div className="flex flex-col gap-3">
        <div ref={row} data-buy-row="" className="flex flex-wrap items-center gap-2">
          <Quantity
            form={FORM}
            name="quantity"
            max={limit ?? 99}
            words={words}
            onValueChange={setQuantity}
          />
          <button
            type="submit"
            form={FORM}
            disabled={!available || pending}
            aria-busy={pending}
            className="gf-btn order-last min-w-0 basis-full @min-[24rem]:order-none @min-[24rem]:basis-0 @min-[24rem]:flex-1"
          >
            {label}
          </button>
          <Favorite
            productId={productId}
            signedIn={signedIn}
            loginPath={favorite.loginPath}
            add={favorite.add}
            words={favorite.words}
          />
        </div>
        <p role="status" aria-live="polite" className="text-sm empty:hidden">
          {!stale && state.ok && (
            <span className="flex flex-wrap items-center gap-x-2 font-semibold text-ok">
              <Check className="size-4" aria-hidden="true" strokeWidth={2.5} />
              {words.added}
              <a href="/sepet" className="gf-link min-h-0 text-text">
                {words.goToCart}
              </a>
            </span>
          )}
          {error && (
            <span className="flex items-start gap-2 text-error">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
              {error}
            </span>
          )}
        </p>
        {whatsapp}
      </div>
      {/* Outside the buy form: a form may not hold another */}
      {variant && !available && (
        <StockAlert
          key={variant.id}
          id={ALERT}
          variantId={variant.id}
          signedIn={signedIn}
          action={stockAlert.action}
          words={stockAlert.words}
        />
      )}
      <BuyBar
        open={barOpen}
        label={words.bar}
        image={image}
        title={title}
        detail={choiceText(options, chosen)}
        price={price}
        before={words.before}
        action={
          available
            ? { kind: "add", form: FORM, label, busy: pending }
            : variant
              ? { kind: "link", href: `#${ALERT}`, label: words.notify }
              : { kind: "link", href: `#${FORM}`, label: words.chooseOptions }
        }
      />
    </div>
  )
}
