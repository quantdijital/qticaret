import { CalendarDays, Clock } from "lucide-react"
import type { ProductCardView, Translate } from "@qticaret/ui"

// Joined by hand, no trailing space without a class (tailwind-merge reads the theme's sizes as colours)
const withClass = (base: string, more: string) => (more ? `${base} ${more}` : base)

/**
 * A dated product's length ("5 gün • 4 gece", adr/0077 Ek "tur kartı"),
 * while the shop shows it and the product has one; nothing otherwise.
 */
export function BookingDuration({
  product,
  className = "",
}: {
  product: ProductCardView
  className?: string
}) {
  const duration = product.look?.duration ? product.booking?.duration : undefined
  if (!duration) {
    return null
  }
  return (
    <p className={withClass("flex items-center gap-1.5 text-xs text-text-2", className)}>
      <Clock className="size-4 shrink-0 text-text-3" aria-hidden="true" strokeWidth={1.75} />
      <span>{duration}</span>
    </p>
  )
}

/**
 * A dated product's price: its lowest paying price as "1.750,00 TL'den
 * itibaren", in the card price's own type, and "kişi başı" after it while
 * the shop asks (adr/0077 Ek "tur kartı").
 */
export function BookingPrice({
  product,
  t,
  className = "",
}: {
  product: ProductCardView
  t: Translate
  className?: string
}) {
  if (!product.price) {
    return null
  }
  const [amount, rest] = fromParts(product.price.current, t)
  return (
    <p className={withClass("flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span className={`${PRICE_TYPE} whitespace-nowrap`}>{amount}</span>
      {rest && <span className={`${PRICE_TYPE} ${NARROW_REST}`}>{rest}</span>}
      {product.look?.perPerson && (
        <span className="text-xs font-medium text-text-2">{t("booking.card_per_person")}</span>
      )}
    </p>
  )
}

/** The card price's own type: heavy, a step up on a card 256 px wide or more. */
const PRICE_TYPE = "tabular text-md font-extrabold tracking-[-0.01em] lg:@min-[16rem]:text-lg"

/**
 * On a card narrower than 13rem (two to a phone's row) the words after the
 * price ("itibaren") drop to their own line in the small type of "kişi
 * başı" beside them: the break is always there, never inside the amount.
 */
const NARROW_REST =
  "@max-[13rem]:text-xs @max-[13rem]:font-medium @max-[13rem]:tracking-normal @max-[13rem]:text-text-2"

/**
 * "1.750,00 TL'den itibaren" as two parts: the amount with the ending
 * joined to it ("1.750,00 TL'den", never broken) and the words after it
 * ("itibaren"); a phrase that does not start with the amount stays whole.
 */
function fromParts(price: string, t: Translate): [string, string] {
  const words = t("booking.card_from", { price })
  if (!words.startsWith(price)) {
    return [words, ""]
  }
  const after = words.slice(price.length)
  const space = after.search(/\s/)
  return space < 0 ? [words, ""] : [price + after.slice(0, space), after.slice(space).trim()]
}

/**
 * A dated product's price row (adr/0076 §10): its from price, then its
 * length when the shop shows it, and under them the nearest departure on
 * sale ("En yakın: 12 Ara") or "Yakında yeni tarihler". Drawn only on a
 * card that carries `booking`; every other card's row is as it was.
 */
export function BookingPriceRow({
  product,
  t,
  className = "",
}: {
  product: ProductCardView
  t: Translate
  className?: string
}) {
  const booking = product.booking
  if (!booking) {
    return null
  }
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <BookingPrice product={product} t={t} />
      <BookingDuration product={product} />
      <BookingNext product={product} t={t} />
    </div>
  )
}

/**
 * The nearest departure on sale ("En yakın: 12 Ara"), or "Yakında yeni
 * tarihler". A date search's card (adr/0077 §4) says the departure is in
 * the dates asked ("Tarihlerinizde: 12 Ara") and, when few, the places
 * left after it ("Son 3 yer"); a card without them reads as before.
 */
export function BookingNext({
  product,
  t,
  className = "",
}: {
  product: ProductCardView
  t: Translate
  className?: string
}) {
  const booking = product.booking
  if (!booking) {
    return null
  }
  return (
    <p className={withClass("flex items-center gap-1.5 text-xs text-text-2", className)}>
      <CalendarDays className="size-4 shrink-0 text-text-3" aria-hidden="true" strokeWidth={1.75} />
      {booking.next && booking.nextAt ? (
        <time dateTime={booking.nextAt}>
          {t(booking.inRange ? "booking.card_in_range" : "booking.card_next", {
            date: booking.next,
          })}
        </time>
      ) : (
        <span>{t("booking.soon")}</span>
      )}
      {booking.next && booking.left !== undefined && (
        <span className="font-semibold text-text">
          <span aria-hidden="true">· </span>
          {t("booking.few_left", { count: booking.left })}
        </span>
      )}
    </p>
  )
}
