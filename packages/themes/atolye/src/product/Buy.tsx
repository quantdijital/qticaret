"use client"

import { Check, CircleAlert, CircleCheck, CircleSlash } from "lucide-react"
import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { formatLira } from "@qticaret/ui"
import type {
  ActionResult,
  AddonFieldView,
  FormAction,
  ImageView,
  InstallmentFamilyView,
  PlaceOrderResult,
  ProductOptionView,
  VariantView,
} from "@qticaret/ui"
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
const INITIAL: ActionResult = { ok: false, error: null }

/**
 * The buy column's working part: the chosen variant's price (with the
 * price-before rule, the saving and a cart offer's note), its stock in
 * words, the options, the add-ons or a gift card's recipient, then one
 * row: how many, "add to cart" in the shop's colour, the favourite heart.
 * The instalments open under it for a variant to be had; a variant out
 * of stock offers the stock alert instead. A choice writes `?variant=` in
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
  words: BuyWords
}) {
  const first = variants.find((each) => each.id === selectedVariantId) ?? variants[0] ?? null
  const [chosen, setChosen] = useState<Record<string, string>>(first?.options ?? {})
  const [state, submit, pending] = useActionState(
    gift?.action ?? addons?.action ?? addToCart,
    INITIAL
  )
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(1)
  const [stale, setStale] = useState(false)
  const [barOpen, setBarOpen] = useState(false)
  const sent = useRef<{ variantId: string; quantity: number } | null>(null)
  const row = useRef<HTMLDivElement>(null)
  const variant = useMemo(() => matching(variants, options, chosen), [variants, options, chosen])

  useEffect(() => {
    if (state.ok && sent.current) {
      announceCartAdded(words.added)
      emitShopEvent({ type: "add_to_cart", ...sent.current })
      sent.current = null
    }
  }, [state, words.added])

  // The phone's bar shows once the row with the button has scrolled away above
  // (read on scroll, not by an observer: a jump past the row crosses nothing)
  useEffect(() => {
    const target = row.current
    if (!target) {
      return
    }
    let frame = 0
    const measure = () => {
      frame = 0
      setBarOpen(target.getBoundingClientRect().bottom < 0)
    }
    const schedule = () => {
      frame ||= window.requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [])

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
  return (
    <div className="gf-buy-stack flex flex-col gap-6">
      {price && <Price price={price} words={words} />}
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
        action={(form) => {
          setStale(false)
          const variantId = form.get("variant_id")
          sent.current = {
            variantId: typeof variantId === "string" ? variantId : "",
            quantity: Number(form.get("quantity") ?? 1) || 1,
          }
          submit(form)
        }}
        onChange={(event) => {
          const target = event.target as { name?: unknown }
          if (typeof target.name === "string" && target.name.startsWith("addon_")) {
            setPicks(picksOf(event.currentTarget))
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
      <p role="status" aria-live="polite" className="-mt-3 text-sm empty:hidden">
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
      {variant && available && (
        <Installments variantId={variant.id} load={installments.load} words={installments.words} />
      )}
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
