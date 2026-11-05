import type { PriceView } from "@qticaret/ui"

/**
 * The buy column's price, set large because it is the offer: the
 * shopper's price heavy (the deal's red when there is a price before),
 * the struck price before it only when the price rule allows one, the
 * discount as a red pill and the saving in words; an automatic cart
 * offer's condition on a tinted line under it, beside the price and
 * never instead of it (adr/0046 Ek 2026-11-05). Every amount is the
 * storefront's own words.
 */
export function Price({
  price,
  words,
}: {
  price: PriceView
  words: { before: string; saving: string; discount: Record<number, string> }
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* Joined by hand: tailwind-merge reads the theme's size names as colours */}
        <span
          className={`tabular text-section leading-none font-extrabold tracking-[-0.02em] ${price.before ? "text-deal" : ""}`}
        >
          {price.current}
        </span>
        {price.before && (
          <s className="tabular text-md text-text-3">
            <span className="sr-only">{words.before} </span>
            {price.before}
          </s>
        )}
        {price.discount !== null && (
          <span className="rounded-pill bg-deal px-2.5 py-1 text-xs font-extrabold text-deal-ink">
            {words.discount[price.discount] ?? `%${String(price.discount)}`}
          </span>
        )}
      </p>
      {price.saving && (
        <p className="text-sm font-semibold text-deal">
          {words.saving.replace("{amount}", price.saving)}
        </p>
      )}
      {price.cartOffer && (
        <p className="self-start rounded-inner bg-signal-soft px-3 py-2 text-sm font-semibold">
          {price.cartOffer}
        </p>
      )}
    </div>
  )
}
